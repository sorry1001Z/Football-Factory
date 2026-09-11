// /api/automation/rights-check  (PRE-N8N BACKEND — FF_HOOK_6)
//
// Auth:    x-automation-secret
// Body:    { run_id, editorial_item_id, media_summary?, source_url?, source_name? }
//
// Behavior:
//   - Verify run <-> editorial association.
//   - Validate body state ∈ {pending, manual_review, rejected, cleared}.
//   - NEUTRAL DEFAULT state: "manual_review" — this endpoint NEVER
//     auto-clears rights for Football Factory's image/content policy.
//   - If caller submits `cleared` AND no rights provider is configured,
//     refuse with 409 (same posture as fact-check).
//   - Persist stage=rights_check + metadata.rights entry.
//   - Editorial row's rights_confirmed is only set to true if state is
//     `cleared` AND a provider is configured. Without a provider,
//     rights_confirmed stays false regardless of state.
//   - Audit log + idempotency on a stable hash of (source_url,
//     source_name, media_summary).

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

const RightsState = z.enum(["pending", "manual_review", "rejected", "cleared"]);

const Hook6Schema = z.object({
  run_id: z.string().uuid(),
  editorial_item_id: z.string().uuid(),
  state: RightsState.default("manual_review"),
  source_url: z.string().trim().max(2048).optional(),
  source_name: z.string().trim().max(256).optional(),
  media_summary: z.array(z.string().max(512)).max(100).optional(),
  rights_holder: z.string().trim().max(256).optional(),
  license: z.string().trim().max(256).optional(),
});

function materialHash(input: {
  source_url?: string | undefined;
  source_name?: string | undefined;
  media_summary?: string[] | undefined;
}): string {
  const s = JSON.stringify({
    source_url: input.source_url ?? null,
    source_name: input.source_name ?? null,
    media_summary: input.media_summary ?? null,
  });
  return crypto.createHash("sha256").update(s, "utf-8").digest("hex").slice(0, 32);
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
  const v = Hook6Schema.safeParse(parsed);
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

  const providerConfigured = Boolean(process.env.RIGHTS_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  // Never auto-clear: refuse `cleared` without a configured provider.
  if (v.data.state === "cleared" && !providerConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "provider_not_configured_for_cleared_state",
      },
      { status: 409 },
    );
  }

  const h = materialHash(v.data);

  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prevR = (meta.rights as { hash?: string; last_at?: string } | undefined) ?? undefined;
  if (prevR?.hash === h) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      provider_status: providerStatus,
      state: v.data.state,
      rights_hash: h,
      run_id: v.data.run_id,
      editorial_item_id: item.id,
      stage: item.stage,
    });
  }

  await items.setStage(item.id, "rights_check", v.data.run_id, "FF_HOOK_6");

  // Only flip rights_confirmed=true if a provider is wired and state is cleared.
  const rightsConfirmed = providerConfigured && v.data.state === "cleared";
  await db.query(
    `UPDATE editorial_items
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object(
                               'rights',
                               jsonb_build_object(
                                 'provider_status', $2::text,
                                 'state', $3::text,
                                 'hash', $4::text,
                                 'rights_holder', $5::text,
                                 'license', $6::text,
                                 'last_at', to_jsonb(now())
                               )
                             ),
            rights_confirmed = $7::bool
      WHERE id = $1`,
    [
      item.id,
      providerStatus,
      v.data.state,
      h,
      v.data.rights_holder ?? null,
      v.data.license ?? null,
      rightsConfirmed,
    ],
  );

  await logs.insert({
    run_id: v.data.run_id,
    action: "editorial_rights_check_completed",
    stage: "rights_check",
    status: "ok",
    message: `FF_HOOK_6 provider=${providerStatus} state=${v.data.state}`,
    metadata: redactSecrets({
      editorial_item_id: item.id,
      provider_status: providerStatus,
      state: v.data.state,
      rights_hash: h,
      rights_confirmed: rightsConfirmed,
    }) as Record<string, unknown>,
  request_id: null,
    ip_hash: null,
  });

  return NextResponse.json({
    ok: true,
    idempotent: false,
    provider_status: providerStatus,
    state: v.data.state,
    rights_hash: h,
    rights_confirmed: rightsConfirmed,
    run_id: v.data.run_id,
    editorial_item_id: item.id,
    stage: "rights_check",
  });
}
