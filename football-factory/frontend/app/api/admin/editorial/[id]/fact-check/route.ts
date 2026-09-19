// Football Factory — POST /api/admin/editorial/[id]/fact-check
//
// Admin-session equivalent of /api/automation/fact-check.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    { run_id, content?, score?, state?, claims_checked? }
//
// Behavior:
//   - Verify run.editorial_item_id == [id] from URL.
//   - Never auto-clear: state="cleared" without a configured provider
//     returns 409.
//   - Persist stage=fact_check + metadata.fact_check entry.
//   - fact_check_score is only set if provider is configured AND a
//     numeric score is supplied; otherwise NULL (never fabricated).
//   - Audit log + idempotency on claims/content hash.

import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import {
  runPipelineStep,
  resultToResponse,
  type PipelineSession,
} from "@/lib/admin/pipeline-runner";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";

export const dynamic = "force-dynamic";

const FactState = z.enum(["pending_manual", "cleared", "flagged", "rejected"]);

const Schema = z.object({
  run_id: z.string().uuid(),
  content: z.string().max(1_000_000).optional(),
  score: z.number().int().min(0).max(100).optional(),
  state: FactState.default("pending_manual"),
  claims_checked: z.array(z.string().min(1).max(2048)).max(500).optional(),
});

function claimsHash(
  claims: string[] | undefined,
  content: string | undefined,
): string {
  const parts: string[] = [];
  if (claims) for (const c of claims) parts.push(c);
  if (content) parts.push(content);
  return crypto
    .createHash("sha256")
    .update(parts.join("\n"), "utf-8")
    .digest("hex")
    .slice(0, 32);
}

async function runner(
  body: z.infer<typeof Schema>,
  session: PipelineSession,
  editorialItemId: string,
) {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false as const,
      status: 503 as const,
      error: "database_not_configured",
    };
  }
  const db = getDb();
  const runs = new AutomationRunRepository(db);
  const items = new EditorialRepository(db);
  const logs = new AutomationLogRepository(db);

  const run = await runs.get(body.run_id);
  if (!run) {
    return {
      ok: false as const,
      status: 404 as const,
      error: "run_not_found",
    };
  }
  if (run.editorial_item_id !== editorialItemId) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "association_mismatch",
    };
  }
  const item = await items.findById(editorialItemId);
  if (!item) {
    return {
      ok: false as const,
      status: 404 as const,
      error: "editorial_item_not_found",
    };
  }

  const providerConfigured = Boolean(process.env.FACT_CHECK_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  // Never auto-clear.
  if (body.state === "cleared" && !providerConfigured) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "provider_not_configured_for_cleared_state",
    };
  }

  const h = claimsHash(body.claims_checked, body.content);

  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prevFc = (meta.fact_check as { hash?: string; last_at?: string } | undefined) ?? undefined;
  if (prevFc?.hash === h) {
    return {
      ok: true as const,
      status: 200 as const,
      body: {
        ok: true,
        idempotent: true,
        provider_status: providerStatus,
        state: body.state,
        claims_hash: h,
        run_id: body.run_id,
        editorial_item_id: item.id,
        stage: item.stage,
      },
    };
  }

  await items.setStage(item.id, "fact_check", body.run_id, "ADMIN_FF_HOOK_5");

  const scoreToPersist =
    providerConfigured && body.score != null ? body.score : null;

  await db.query(
    `UPDATE editorial_items
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object(
                               'fact_check',
                               jsonb_build_object(
                                 'provider_status', $2::text,
                                 'state', $3::text,
                                 'hash', $4::text,
                                 'last_at', to_jsonb(now()),
                                 'actor_user_id', $5::text
                               )
                             ),
            fact_check_score = COALESCE($6::int, fact_check_score)
      WHERE id = $1`,
    [item.id, providerStatus, body.state, h, session.userId, scoreToPersist],
  );

  await logs.insert({
    run_id: body.run_id,
    action: "admin_editorial_fact_check_completed",
    stage: "fact_check",
    status: "ok",
    message: `ADMIN FF_HOOK_5 provider=${providerStatus} state=${body.state}`,
    metadata: {
      editorial_item_id: item.id,
      provider_status: providerStatus,
      state: body.state,
      claims_hash: h,
      score: scoreToPersist,
      actor_user_id: session.userId,
    },
    request_id: null,
    ip_hash: null,
  });

  return {
    ok: true as const,
    status: 200 as const,
    body: {
      ok: true,
      idempotent: false,
      provider_status: providerStatus,
      state: body.state,
      claims_hash: h,
      score: scoreToPersist,
      run_id: body.run_id,
      editorial_item_id: item.id,
      stage: "fact_check",
    },
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: editorialItemId } = await context.params;
  const r = await runPipelineStep(
    request,
    {
      bucket: "fact_check",
      limit: 30,
      windowMs: 60_000,
      schema: Schema,
    },
    async ({ body, session }) => runner(body, session, editorialItemId),
  );
  return resultToResponse(r);
}
