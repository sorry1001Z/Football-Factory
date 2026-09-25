// /api/automation/wp-draft (FIRST SLICE)
//
// Auth:    x-automation-secret
// Body:    { run_id, title, content, categories?, tags?, featured_media? }
//
// Behavior:
//   - Verifies run_id exists (created via /api/automation/deduplicate).
//   - Creates a WordPress draft via the write client (NEVER publish).
//   - Updates automation_runs.status to 'waiting_approval' on success.
//   - On failure: status='failed', error=message, returns 502.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import {
  assertAutomationEnabled,
  automationDisabledResponse,
} from "@/lib/automation/kill-switch";
import {
  AUTOMATION_RL,
  consumeAutomationRateLimit,
  rateLimitedResponse,
} from "@/lib/automation/rate-limit-helpers";
import {
  decideWpDraft,
} from "@/lib/automation/wp-draft-idempotency";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { assertTransition, StageTransitionError } from "@/lib/auth/stage-machine";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";
import {
  WordPressWriteClient,
  WordPressWriteError,
} from "@/lib/wordpress/write";
import { buildEditorialWpFields } from "@/lib/automation/wp-draft-editorial-fields";

export const dynamic = "force-dynamic";

const WpDraftSchema = z.object({
  run_id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  content: z.string().min(1).max(1_000_000),
  excerpt: z.string().trim().max(500).optional(),
  slug: z.string().trim().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  categories: z.array(z.number().int().positive()).max(50).optional(),
  tags: z.array(z.number().int().positive()).max(100).optional(),
  featured_media: z.number().int().positive().optional(),
  // Optional: link this run to an editorial_items row so the publish
  // path can verify approval state. When NULL, wp-publish will refuse
  // to publish with `editorial_link_missing`.
  editorial_item_id: z.string().uuid().optional(),
  recovery_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const a = verifyAutomationSecret(request);
  if (!a.ok) return authRejectResponse(a);

  // Step 2: kill-switch. Fail-closed when AUTOMATION_ENABLED != "true".
  const ks = assertAutomationEnabled();
  if (!ks.ok) return automationDisabledResponse();

  // Step 3: per-instance rate limit. Conservative limit: 10 drafts / 60s / IP.
  const rl = consumeAutomationRateLimit(request, AUTOMATION_RL.wpDraft);
  if (!rl.ok) return rateLimitedResponse(rl.resetMs);

  const body = await readCappedBody(request, "automation");
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, error: body.reason === "too_large" ? "body_too_large" : "body_invalid" },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const v = WpDraftSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "database_not_configured" },
      { status: 503 },
    );
  }
  const runs = new AutomationRunRepository(getDb());
  const logs = new AutomationLogRepository(getDb());
  const run = await runs.get(v.data.run_id);
  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
  }

  // Idempotency: if this run already produced a wp_post_id, and the
  // editorial linkage is consistent, reuse it WITHOUT calling WP.
  const decision = decideWpDraft(
    run.output ?? null,
    run.editorial_item_id ?? null,
    v.data.editorial_item_id,
  );
  if (!decision.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: decision.error,
        ...("details" in decision ? decision.details : {}),
      },
      { status: decision.status },
    );
  }
  if (decision.reuse) {
    return NextResponse.json(
      {
        ok: true,
        run_id: v.data.run_id,
        wp_post_id: decision.wp_post_id,
        status: "draft",
        idempotent: true,
        note: "wp-draft idempotency: run.output.wp_post_id reused",
      },
      { status: 200 },
    );
  }

  let editorialWpFields = {
    title: v.data.title,
    content: v.data.content,
    ...(v.data.excerpt !== undefined ? { excerpt: v.data.excerpt } : {}),
    ...(v.data.slug !== undefined ? { slug: v.data.slug } : {}),
  };
  if (v.data.editorial_item_id) {
    const editorial = new EditorialRepository(getDb());
    const item = await editorial.findById(v.data.editorial_item_id);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: "editorial_item_not_found" },
        { status: 404 },
      );
    }
    const metadata =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, unknown>)
        : {};
    // Editorial metadata is the saved source of truth for the CMS fields.
    // The workflow's title/content remain a fallback for legacy callers.
    editorialWpFields = buildEditorialWpFields({
      metadata,
      fallbackTitle: v.data.title,
      fallbackContent: v.data.content,
      fallbackExcerpt: v.data.excerpt,
      fallbackSlug: v.data.slug,
    });
    const missingChecks = ["seo_check", "fact_check", "rights"].filter(
      (key) => !metadata[key] || typeof metadata[key] !== "object",
    );
    if (missingChecks.length > 0) {
      return NextResponse.json(
        { ok: false, error: "editorial_checks_incomplete" },
        { status: 409 },
      );
    }
    try {
      assertTransition(item.stage, "draft_created");
    } catch (error) {
      if (!(error instanceof StageTransitionError)) throw error;
      return NextResponse.json(
        { ok: false, error: "invalid_stage_transition" },
        { status: 409 },
      );
    }
  }

  const wp = new WordPressWriteClient();
  if (!wp.configured) {
    await runs.setStatus(v.data.run_id, "failed", undefined, "wp_write_not_configured");
    return NextResponse.json(
      { ok: false, error: "wp_write_not_configured" },
      { status: 503 },
    );
  }

  // Persist the run↔editorial association before creating an external draft.
  // A retry after a lost response can then prove it is referring to the same
  // editorial item instead of silently attaching a different one.
  if (v.data.editorial_item_id && !run.editorial_item_id) {
    const linked = await getDb().query(
      `UPDATE automation_runs SET editorial_item_id = $2, updated_at = now()
        WHERE id = $1 AND editorial_item_id IS NULL`,
      [v.data.run_id, v.data.editorial_item_id],
    );
    if (linked.rowCount === 0) {
      const current = await runs.get(v.data.run_id);
      if (current?.editorial_item_id !== v.data.editorial_item_id) {
        return NextResponse.json({ ok: false, error: "editorial_linkage_conflict" }, { status: 409 });
      }
    }
  }

  // A unique operation row is the durable at-most-once guard around the
  // non-transactional WordPress POST. A timed-out/lost response remains
  // uncertain and is never blindly retried, since WordPress may have made
  // the draft despite the missing response.
  const operationClaim = await getDb().query<{ run_id: string }>(
    `INSERT INTO wp_draft_operations (run_id, editorial_item_id, status)
     VALUES ($1, $2, 'started')
     ON CONFLICT (run_id) DO NOTHING
     RETURNING run_id`,
    [v.data.run_id, v.data.editorial_item_id ?? run.editorial_item_id],
  );
  if (!operationClaim.rows[0]) {
    const existingOperation = await getDb().query<{ status: string; wp_post_id: number | null }>(
      `SELECT status, wp_post_id FROM wp_draft_operations WHERE run_id = $1 LIMIT 1`,
      [v.data.run_id],
    );
    const op = existingOperation.rows[0];
    if (op?.status === "created" && op.wp_post_id) {
      await runs.setStatus(v.data.run_id, "waiting_approval", { wp_post_id: op.wp_post_id });
      await completeRecovery(v.data.recovery_id, v.data.run_id);
      return NextResponse.json({ ok: true, run_id: v.data.run_id, wp_post_id: op.wp_post_id, status: "draft", idempotent: true }, { status: 200 });
    }
    return NextResponse.json(
      { ok: false, error: op?.status === "uncertain" ? "draft_creation_uncertain_manual_reconciliation_required" : "draft_creation_already_started" },
      { status: 409 },
    );
  }

  try {
    const post = await wp.createPost({
      ...editorialWpFields,
      status: "draft",
      categories: v.data.categories,
      tags: v.data.tags,
      featured_media: v.data.featured_media,
    });
    await getDb().query(
      `UPDATE wp_draft_operations
          SET status = 'created', wp_post_id = $2, updated_at = now()
        WHERE run_id = $1 AND status = 'started'`,
      [v.data.run_id, post.id],
    );
    await runs.setStatus(v.data.run_id, "waiting_approval", { wp_post_id: post.id });
    await completeRecovery(v.data.recovery_id, v.data.run_id);
    // If caller provided editorial_item_id, persist it on the run so the
    // publish path can verify approval state. Best-effort: a failure
    // here must NOT roll back the draft creation. We surface the error
    // in the response payload but still return 201 for the draft.
    let editorialLinkError: string | null = null;
    if (v.data.editorial_item_id) {
      try {
        // Sync editorial_items.stage to draft_created → waiting_approval.
        // Stage advance uses the published stage-machine; if the item is
        // currently at a non-canonical stage (hand-edited), we accept the
        // forward move per the stage-machine contract.
        const { EditorialRepository } = await import("@/lib/auth/editorial-repository");
        const editorial = new EditorialRepository(getDb());
        const item = await editorial.findById(v.data.editorial_item_id);
        if (item && item.stage !== "draft_created" && item.stage !== "waiting_approval") {
          // setStage throws StageTransitionError for invalid moves; in
          // that case we surface a warning but do NOT roll back the
          // draft.
          try {
            await editorial.setStage(item.id, "draft_created", v.data.run_id, "FF_HOOK_9");
            await editorial.setStage(
              item.id,
              "waiting_approval",
              v.data.run_id,
              "FF_HOOK_9",
            );
          } catch (e) {
            editorialLinkError =
              "stage_advance_warning: " + ((e as Error)?.message ?? "unknown");
          }
        }
      } catch (e) {
        editorialLinkError = (e as Error)?.message ?? "editorial_link_failed";
      }
    }
    return NextResponse.json(
      {
        ok: true,
        run_id: v.data.run_id,
        wp_post_id: post.id,
        status: "draft",
        ...(editorialLinkError ? { editorial_link_warning: editorialLinkError } : {}),
      },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof WordPressWriteError ? e.kind : "wp_error";
    const uncertain = !(e instanceof WordPressWriteError) ||
      ["timeout", "network", "http_5xx"].includes(e.kind);
    await getDb().query(
      `UPDATE wp_draft_operations
          SET status = $2, error_class = $3, updated_at = now()
        WHERE run_id = $1 AND status = 'started'`,
      [v.data.run_id, uncertain ? "uncertain" : "failed", uncertain ? (msg === "wp_error" ? "unknown" : msg) : "validation"],
    );
    await runs.setStatus(v.data.run_id, "failed", undefined, msg);
    if (e instanceof WordPressWriteError) {
      return NextResponse.json({ ok: false, error: e.kind }, { status: 502 });
    }
    throw e;
  }
}

async function completeRecovery(recoveryId: string | undefined, runId: string): Promise<void> {
  if (!recoveryId) return;
  await getDb().query(
    `UPDATE automation_run_recoveries
        SET status = 'completed', finished_at = now(), updated_at = now()
      WHERE id = $1 AND run_id = $2 AND status = 'claimed'`,
    [recoveryId, runId],
  );
}
