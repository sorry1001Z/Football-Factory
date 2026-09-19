// Football Factory — POST /api/admin/editorial/[id]/rights-check
//
// Admin-session equivalent of /api/automation/rights-check.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    { run_id, state?, source_url?, source_name?, media_summary?,
//            rights_holder?, license? }
//
// Behavior:
//   - Verify run.editorial_item_id == [id].
//   - NEUTRAL DEFAULT state: "manual_review" — this endpoint NEVER
//     auto-clears rights.
//   - state="cleared" without a configured rights provider returns 409.
//   - editorial_items.rights_confirmed stays false unless provider
//     configured AND state=cleared.
//   - Persist stage=rights_check + metadata.rights entry.
//   - Audit log + idempotency on (source_url, source_name, media_summary).

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

const RightsState = z.enum(["pending", "manual_review", "rejected", "cleared"]);

const Schema = z.object({
  run_id: z.string().uuid(),
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

  const providerConfigured = Boolean(process.env.RIGHTS_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  if (body.state === "cleared" && !providerConfigured) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "provider_not_configured_for_cleared_state",
    };
  }

  const h = materialHash(body);

  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prevR = (meta.rights as { hash?: string; last_at?: string } | undefined) ?? undefined;
  if (prevR?.hash === h) {
    return {
      ok: true as const,
      status: 200 as const,
      body: {
        ok: true,
        idempotent: true,
        provider_status: providerStatus,
        state: body.state,
        rights_hash: h,
        run_id: body.run_id,
        editorial_item_id: item.id,
        stage: item.stage,
      },
    };
  }

  await items.setStage(item.id, "rights_check", body.run_id, "ADMIN_FF_HOOK_6");

  const rightsConfirmed = providerConfigured && body.state === "cleared";
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
                                 'last_at', to_jsonb(now()),
                                 'actor_user_id', $7::text
                               )
                             ),
            rights_confirmed = $8::bool
      WHERE id = $1`,
    [
      item.id,
      providerStatus,
      body.state,
      h,
      body.rights_holder ?? null,
      body.license ?? null,
      session.userId,
      rightsConfirmed,
    ],
  );

  await logs.insert({
    run_id: body.run_id,
    action: "admin_editorial_rights_check_completed",
    stage: "rights_check",
    status: "ok",
    message: `ADMIN FF_HOOK_6 provider=${providerStatus} state=${body.state}`,
    metadata: {
      editorial_item_id: item.id,
      provider_status: providerStatus,
      state: body.state,
      rights_hash: h,
      rights_confirmed: rightsConfirmed,
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
      rights_hash: h,
      rights_confirmed: rightsConfirmed,
      run_id: body.run_id,
      editorial_item_id: item.id,
      stage: "rights_check",
    },
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: editorialItemId } = await context.params;
  const r = await runPipelineStep(
    request,
    {
      bucket: "rights_check",
      limit: 30,
      windowMs: 60_000,
      schema: Schema,
    },
    async ({ body, session }) => runner(body, session, editorialItemId),
  );
  return resultToResponse(r);
}
