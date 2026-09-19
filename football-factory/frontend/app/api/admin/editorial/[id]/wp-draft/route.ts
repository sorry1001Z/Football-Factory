// Football Factory — POST /api/admin/editorial/[id]/wp-draft
//
// Admin-session equivalent of /api/automation/wp-draft.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    { run_id, title, content, categories?, tags?, featured_media? }
//
// Behavior:
//   - Verifies run_id exists.
//   - Idempotency: reuses run.output.wp_post_id if present (no double
//     draft). Same decideWpDraft() helper as /api/automation/wp-draft.
//   - Creates a WordPress DRAFT via WordPressWriteClient. Never publish.
//   - Updates automation_runs.status = "waiting_approval".
//   - Updates editorial_items.wp_post_id, advances stage to
//     draft_created -> waiting_approval.
//   - Audit log.
//
// NO publish endpoint in this file. Publish remains a separate
// operator-only action (out of scope for this slice).

import "server-only";
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
import { decideWpDraft } from "@/lib/automation/wp-draft-idempotency";
import {
  WordPressWriteClient,
  WordPressWriteError,
} from "@/lib/wordpress/write";

export const dynamic = "force-dynamic";

const Schema = z.object({
  run_id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  content: z.string().min(1).max(1_000_000),
  categories: z.array(z.number().int().positive()).max(50).optional(),
  tags: z.array(z.number().int().positive()).max(100).optional(),
  featured_media: z.number().int().positive().optional(),
});

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

  // Idempotency: reuse run.output.wp_post_id if present.
  const decision = decideWpDraft(run.output ?? null, run.editorial_item_id, editorialItemId);
  if (!decision.ok) {
    return {
      ok: false as const,
      status: decision.status as 409,
      error: decision.error,
      details: "details" in decision ? decision.details : undefined,
    };
  }
  if (decision.reuse) {
    return {
      ok: true as const,
      status: 200 as const,
      body: {
        ok: true,
        run_id: body.run_id,
        wp_post_id: decision.wp_post_id,
        status: "draft",
        idempotent: true,
        note: "wp-draft idempotency: run.output.wp_post_id reused",
      },
    };
  }

  const wp = new WordPressWriteClient();
  if (!wp.configured) {
    await runs.setStatus(body.run_id, "failed", undefined, "wp_write_not_configured");
    await logs.insert({
      run_id: body.run_id,
      action: "admin_wp_draft_failed",
      stage: item.stage,
      status: "error",
      message: "wp_write_not_configured",
      metadata: {
        editorial_item_id: item.id,
        actor_user_id: session.userId,
      },
      request_id: null,
      ip_hash: null,
    });
    return {
      ok: false as const,
      status: 503 as const,
      error: "wp_write_not_configured",
    };
  }

  try {
    const post = await wp.createPost({
      title: body.title,
      content: body.content,
      status: "draft",
      categories: body.categories,
      tags: body.tags,
      featured_media: body.featured_media,
    });

    await runs.setStatus(body.run_id, "waiting_approval", { wp_post_id: post.id });

    // Sync editorial_item.wp_post_id and advance stage.
    let stageWarn: string | null = null;
    try {
      await db.query(
        `UPDATE editorial_items SET wp_post_id = $2 WHERE id = $1`,
        [item.id, post.id],
      );
      // Stage advance: draft_created -> waiting_approval.
      // Use the stage-machine contract: only forward; do not skip.
      const cur = await items.findById(item.id);
      if (cur && cur.stage !== "draft_created" && cur.stage !== "waiting_approval") {
        try {
          await items.setStage(item.id, "draft_created", body.run_id, "ADMIN_FF_HOOK_9");
          await items.setStage(item.id, "waiting_approval", body.run_id, "ADMIN_FF_HOOK_9");
        } catch (e) {
          stageWarn =
            "stage_advance_warning: " + ((e as Error)?.message ?? "unknown");
        }
      } else if (cur && cur.stage === "draft_created") {
        await items.setStage(item.id, "waiting_approval", body.run_id, "ADMIN_FF_HOOK_9");
      }
    } catch (e) {
      stageWarn = (e as Error)?.message ?? "stage_sync_failed";
    }

    await logs.insert({
      run_id: body.run_id,
      action: "admin_wp_draft_created",
      stage: "waiting_approval",
      status: "ok",
      message: `ADMIN FF_HOOK_9 wp_post_id=${post.id}`,
      metadata: {
        editorial_item_id: item.id,
        wp_post_id: post.id,
        actor_user_id: session.userId,
      },
      request_id: null,
      ip_hash: null,
    });

    return {
      ok: true as const,
      status: 201 as const,
      body: {
        ok: true,
        run_id: body.run_id,
        wp_post_id: post.id,
        status: "draft",
        ...(stageWarn ? { stage_advance_warning: stageWarn } : {}),
      },
    };
  } catch (e) {
    const msg = e instanceof WordPressWriteError ? e.kind : "wp_error";
    await runs.setStatus(body.run_id, "failed", undefined, msg);
    await logs.insert({
      run_id: body.run_id,
      action: "admin_wp_draft_failed",
      stage: item.stage,
      status: "error",
      message: msg,
      metadata: {
        editorial_item_id: item.id,
        actor_user_id: session.userId,
      },
      request_id: null,
      ip_hash: null,
    });
    if (e instanceof WordPressWriteError) {
      return { ok: false as const, status: 502 as const, error: e.kind };
    }
    throw e;
  }
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: editorialItemId } = await context.params;
  const r = await runPipelineStep(
    request,
    {
      bucket: "wp_draft",
      limit: 10,
      windowMs: 60_000,
      schema: Schema,
    },
    async ({ body, session }) => runner(body, session, editorialItemId),
  );
  return resultToResponse(r);
}
