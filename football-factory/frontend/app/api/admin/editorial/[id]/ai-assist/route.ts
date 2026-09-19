// Football Factory — POST /api/admin/editorial/[id]/ai-assist
//
// Admin-session equivalent of /api/automation/ai-assist.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    { run_id, content?, content_hash? }
//
// Behavior:
//   - Verify run.editorial_item_id == [id] from URL, else 409.
//   - Compute stable content fingerprint (sha256 first 32 hex chars).
//   - No AI provider is configured today (provider_status=not_configured).
//   - Persist stage=ai_assist + metadata.ai_assist entry.
//   - Audit log + idempotency on content_hash.

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

const Schema = z.object({
  run_id: z.string().uuid(),
  content: z.string().max(1_000_000).optional(),
  content_hash: z.string().trim().min(8).max(128).optional(),
});

function fingerprint(
  content: string | undefined,
  supplied: string | undefined,
): string {
  if (supplied) return supplied;
  if (!content) return "empty";
  return crypto
    .createHash("sha256")
    .update(content, "utf-8")
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

  const providerConfigured = Boolean(process.env.AI_ASSIST_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  const h = fingerprint(body.content, body.content_hash);

  // Idempotency check
  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prevAi = (meta.ai_assist as { hash?: string; last_at?: string } | undefined) ?? undefined;
  if (prevAi?.hash === h) {
    return {
      ok: true as const,
      status: 200 as const,
      body: {
        ok: true,
        idempotent: true,
        provider_status: providerStatus,
        content_hash: h,
        run_id: body.run_id,
        editorial_item_id: item.id,
        stage: item.stage,
      },
    };
  }

  await items.setStage(item.id, "ai_assist", body.run_id, "ADMIN_FF_HOOK_4");

  await db.query(
    `UPDATE editorial_items
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object(
                               'ai_assist',
                               jsonb_build_object(
                                 'provider_status', $2::text,
                                 'content_hash', $3::text,
                                 'last_at', to_jsonb(now())
                               )
                             )
      WHERE id = $1`,
    [item.id, providerStatus, h],
  );

  await logs.insert({
    run_id: body.run_id,
    action: "admin_editorial_ai_assist_completed",
    stage: "ai_assist",
    status: "ok",
    message: `ADMIN FF_HOOK_4 provider=${providerStatus}`,
    metadata: {
      editorial_item_id: item.id,
      provider_status: providerStatus,
      content_hash: h,
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
      content_hash: h,
      run_id: body.run_id,
      editorial_item_id: item.id,
      stage: "ai_assist",
    },
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: editorialItemId } = await context.params;
  const r = await runPipelineStep(
    request,
    {
      bucket: "ai_assist",
      limit: 30,
      windowMs: 60_000,
      schema: Schema,
    },
    async ({ body, session }) => runner(body, session, editorialItemId),
  );
  return resultToResponse(r);
}
