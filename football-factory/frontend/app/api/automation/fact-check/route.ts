// /api/automation/fact-check  (PRE-N8N BACKEND — FF_HOOK_5)
//
// Auth:    x-automation-secret
// Body:    { run_id, editorial_item_id, content?, score?, claims_checked? }
//
// Behavior:
//   - Verify run <-> editorial association (same as FF_HOOK_4).
//   - Validate score if present (0..100).
//   - Without a real fact-check provider, default state =
//     "pending_manual". We do NOT silently clear or pass.
//   - Persist stage=fact_check + fact_check_score (only if body.score is
//     authoritative body-supplied source — when no provider is wired,
//     we record score=null so we never fabricate a passing number).
//   - Audit log.
//   - Idempotent: same (run_id, editorial_item_id, claims_checked hash)
//     returns existing metadata.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { readCappedBody } from "@/lib/security/body-cap";
import { redactSecrets } from "@/lib/auth/redact-secrets";
import {
  verifyAutomationSecret,
  authRejectResponse,
} from "@/lib/automation/auth";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";

export const dynamic = "force-dynamic";

const FactState = z.enum(["pending_manual", "cleared", "flagged", "rejected"]);

const Hook5Schema = z.object({
  run_id: z.string().uuid(),
  editorial_item_id: z.string().uuid(),
  content: z.string().max(1_000_000).optional(),
  score: z.number().int().min(0).max(100).optional(),
  state: FactState.default("pending_manual"),
  claims_checked: z.array(z.string().min(1).max(2048)).max(500).optional(),
});

function claimsHash(claims: string[] | undefined, content: string | undefined): string {
  const parts: string[] = [];
  if (claims) for (const c of claims) parts.push(c);
  if (content) parts.push(content);
  const joined = parts.join("\n");
  return crypto
    .createHash("sha256")
    .update(joined, "utf-8")
    .digest("hex")
    .slice(0, 32);
}

export async function POST(request: Request) {
  const a = verifyAutomationSecret(request);
  if (!a.ok) return authRejectResponse(a);

  const body = await readCappedBody(request, "automation");
  if (!body.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: body.reason === "too_large" ? "body_too_large" : "body_invalid",
      },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const v = Hook5Schema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "database_not_configured" },
      { status: 503 },
    );
  }

  const db = getDb();
  const runs = new AutomationRunRepository(db);
  const items = new EditorialRepository(db);
  const logs = new AutomationLogRepository(db);

  const run = await runs.get(v.data.run_id);
  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
  }
  const item = await items.findById(v.data.editorial_item_id);
  if (!item) {
    return NextResponse.json(
      { ok: false, error: "editorial_item_not_found" },
      { status: 404 },
    );
  }
  const linkedItem = await items.findByRunId(v.data.run_id);
  if (!linkedItem || linkedItem.id !== v.data.editorial_item_id) {
    return NextResponse.json(
      { ok: false, error: "association_mismatch" },
      { status: 409 },
    );
  }

  const providerConfigured = Boolean(process.env.FACT_CHECK_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  const h = claimsHash(v.data.claims_checked, v.data.content);
  // Never auto-clear: if no provider is wired, we only accept
  // "pending_manual" or "flagged" or "rejected" from the request;
  // anything marked "cleared" without a provider returns 503.
  if (v.data.state === "cleared" && !providerConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "provider_not_configured_for_cleared_state",
      },
      { status: 409 },
    );
  }

  // Idempotency on claims hash.
  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prevFc = (meta.fact_check as { hash?: string; last_at?: string } | undefined) ?? undefined;
  if (prevFc?.hash === h) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      provider_status: providerStatus,
      state: v.data.state,
      claims_hash: h,
      run_id: v.data.run_id,
      editorial_item_id: item.id,
      stage: item.stage,
    });
  }

  await items.setStage(item.id, "fact_check", v.data.run_id, "FF_HOOK_5");

  // Persist fact_check metadata + fact_check_score.
  // Without a provider, score is NULL to avoid fabricating a number.
  const scoreToPersist = providerConfigured && v.data.score != null ? v.data.score : null;
  await db.query(
    `UPDATE editorial_items
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object(
                               'fact_check',
                               jsonb_build_object(
                                 'provider_status', $2::text,
                                 'state', $3::text,
                                 'hash', $4::text,
                                 'last_at', to_jsonb(now())
                               )
                             ),
            fact_check_score = COALESCE($5::int, fact_check_score)
      WHERE id = $1`,
    [item.id, providerStatus, v.data.state, h, scoreToPersist],
  );

  await logs.insert({
    run_id: v.data.run_id,
    action: "editorial_fact_check_completed",
    stage: "fact_check",
    status: "ok",
    message: `FF_HOOK_5 provider=${providerStatus} state=${v.data.state}`,
    metadata: redactSecrets({
      editorial_item_id: item.id,
      provider_status: providerStatus,
      state: v.data.state,
      claims_hash: h,
      score: scoreToPersist,
    }) as Record<string, unknown>,
  request_id: null,
    ip_hash: null,
  });

  return NextResponse.json({
    ok: true,
    idempotent: false,
    provider_status: providerStatus,
    state: v.data.state,
    claims_hash: h,
    score: scoreToPersist,
    run_id: v.data.run_id,
    editorial_item_id: item.id,
    stage: "fact_check",
  });
}
