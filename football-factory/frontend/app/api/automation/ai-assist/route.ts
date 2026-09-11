// /api/automation/ai-assist  (PRE-N8N BACKEND — FF_HOOK_4)
//
// Auth:    x-automation-secret
// Body:    { run_id, editorial_item_id, content?, content_hash? }
//
// Behavior:
//   - Verify run.editorial_item_id == body.editorial_item_id, else 409.
//   - Compute a stable content fingerprint (length, sha256 if Node).
//   - If a real AI provider is configured (AI_ASSIST_PROVIDER_URL),
//     provider_status="configured" and we leave room for future
//     fetch wiring. For this slice, no provider is configured and we
//     return provider_status="not_configured" deterministically.
//   - Persist stage=ai_assist + metadata.ai_assist entry.
//   - Audit log.
//   - Idempotent: same content_hash returns 200 idempotent=true; only
//     updates metadata on a fresh hash.

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

const Hook4Schema = z.object({
  run_id: z.string().uuid(),
  editorial_item_id: z.string().uuid(),
  content: z.string().max(1_000_000).optional(),
  content_hash: z.string().trim().min(8).max(128).optional(),
});

function fingerprint(content: string | undefined, supplied: string | undefined): string {
  if (supplied) return supplied;
  if (!content) return "empty";
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex").slice(0, 32);
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
  const v = Hook4Schema.safeParse(parsed);
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

  // 1) run exists + linked to editorial_item_id
  const run = await runs.get(v.data.run_id);
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "run_not_found" },
      { status: 404 },
    );
  }
  const item = await items.findById(v.data.editorial_item_id);
  if (!item) {
    return NextResponse.json(
      { ok: false, error: "editorial_item_not_found" },
      { status: 404 },
    );
  }
  // Re-resolve via run.editorial_item_id and verify match.
  const linkedItem = await items.findByRunId(v.data.run_id);
  if (!linkedItem || linkedItem.id !== v.data.editorial_item_id) {
    return NextResponse.json(
      { ok: false, error: "association_mismatch" },
      { status: 409 },
    );
  }

  // 2) provider status — currently no AI provider wired.
  const providerConfigured = Boolean(process.env.AI_ASSIST_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  const fp = fingerprint(v.data.content, v.data.content_hash);

  // 3) idempotency: check if metadata.ai_assist.last_hash == fp
  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prev = (meta.ai_assist as { last_hash?: string; last_at?: string } | undefined) ?? undefined;
  if (prev?.last_hash === fp) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      provider_status: providerStatus,
      last_hash: fp,
      last_at: prev.last_at,
      run_id: v.data.run_id,
      editorial_item_id: item.id,
      stage: item.stage,
    });
  }

  // 4) persist stage + metadata
  await items.setStage(item.id, "ai_assist", v.data.run_id, "FF_HOOK_4");

  // Insert ai_assist into metadata (we update via a follow-up SQL UPDATE
  // because the setStage already touched metadata.stage_history).
  await db.query(
    `UPDATE editorial_items
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object(
                               'ai_assist',
                               jsonb_build_object(
                                 'provider_status', $2::text,
                                 'last_hash', $3::text,
                                 'last_at',   to_jsonb(now())
                               )
                             )
      WHERE id = $1`,
    [item.id, providerStatus, fp],
  );

  await logs.insert({
    run_id: v.data.run_id,
    action: "editorial_ai_assist_completed",
    stage: "ai_assist",
    status: "ok",
    message: `FF_HOOK_4 provider=${providerStatus}`,
    metadata: redactSecrets({
      editorial_item_id: item.id,
      provider_status: providerStatus,
      content_hash: fp,
    }) as Record<string, unknown>,
  request_id: null,
    ip_hash: null,
  });

  return NextResponse.json({
    ok: true,
    idempotent: false,
    provider_status: providerStatus,
    last_hash: fp,
    run_id: v.data.run_id,
    editorial_item_id: item.id,
    stage: "ai_assist",
  });
}
