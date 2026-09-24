import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { getDb, withTx } from "@/lib/db/postgres";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { redactSecrets } from "@/lib/auth/redact-secrets";
import { inspectRecovery } from "@/lib/automation/recovery-policy";

export const dynamic = "force-dynamic";

const IdSchema = z.object({ runId: z.string().uuid() });
const EditorialSchema = z.object({
  title_th: z.string().trim().min(1).max(500),
  body_th: z.string().trim().min(200).max(1_000_000),
  excerpt_th: z.string().trim().max(500).optional(),
  slug: z.string().trim().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  news_type: z.enum(["RESULT", "PREVIEW", "ANALYSIS", "TRANSFER", "BREAKING"]).optional(),
});
const BodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  dry_run: z.boolean().default(true),
  editorial: EditorialSchema.optional(),
});

type RunRow = {
  id: string;
  workflow: string;
  status: "running" | "draft_creating" | "held_for_content" | "recovery_queued" | "success" | "failed" | "waiting_approval" | "rejected";
  input: unknown;
  output: unknown;
  editorial_item_id: string | null;
  stage: string | null;
  error_class: "timeout" | "network" | "upstream_temporary" | "wp_retryable" | "auth" | "validation" | "unknown" | null;
  updated_at: string;
  recovery_count: number;
};

type EditorialRow = {
  id: string;
  source_id: string;
  wp_post_id: number | null;
  stage: string;
  approval_state: "pending" | "approved" | "rejected";
  rights_confirmed: boolean;
  metadata: unknown;
};

type DraftOperationRow = { status: "started" | "created" | "uncertain" | "failed"; wp_post_id: number | null };

export async function GET(request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const auth = requireAdminOrEditor(request);
  const denied = guardResponse(auth);
  if (denied) return denied;
  const { runId } = await ctx.params;
  const parsedId = IdSchema.safeParse({ runId });
  if (!parsedId.success) return NextResponse.json({ ok: false, error: "invalid_run_id" }, { status: 400 });

  const db = getDb();
  const runResult = await db.query<RunRow>(
    `SELECT id, workflow, status, input, output, editorial_item_id,
            stage, error_class, updated_at, recovery_count
       FROM automation_runs WHERE id = $1 LIMIT 1`,
    [parsedId.data.runId],
  );
  const run = runResult.rows[0];
  if (!run) return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });

  const editorialResult = run.editorial_item_id
    ? await db.query<EditorialRow>(
        `SELECT id, source_id, wp_post_id, stage, approval_state, rights_confirmed, metadata
           FROM editorial_items WHERE id = $1 LIMIT 1`,
        [run.editorial_item_id],
      )
    : { rows: [] as EditorialRow[], rowCount: 0 };
  const editorial = editorialResult.rows[0] ?? null;
  const metadata = asRecord(editorial?.metadata);
  const decision = editorial
    ? inspectRecovery({
        status: run.status,
        updatedAt: run.updated_at,
        stage: run.stage ?? editorial.stage,
        errorClass: run.error_class,
        recoveryCount: run.recovery_count,
        hasRunWpPostId: Boolean(asRecord(run.output).wp_post_id),
        editorialWpPostId: editorial.wp_post_id,
        approvalState: editorial.approval_state,
        editorialContentComplete: hasEditorialContent(metadata),
      })
    : { allowed: false, reason: "editorial_link_missing", interrupted: false, attempt: run.recovery_count, backoffMs: 0 };

  const [events, active, draftOperation] = await Promise.all([
    db.query(
      `SELECT id, action, created_at, metadata
         FROM audit_logs
        WHERE resource_type = 'automation_run' AND resource_id = $1
        ORDER BY id DESC LIMIT 20`,
      [run.id],
    ),
    db.query<{ status: string }>(
      `SELECT id, status, reason, resume_stage, attempt, available_at, created_at
         FROM automation_run_recoveries
        WHERE run_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [run.id],
    ),
    db.query<DraftOperationRow>(
      `SELECT status, wp_post_id FROM wp_draft_operations WHERE run_id = $1 LIMIT 1`,
      [run.id],
    ),
  ]);
  const safeInput = redactSecrets(asRecord(run.input)) as Record<string, unknown>;
  const safeMetadata = redactSecrets(metadata) as Record<string, unknown>;
  return NextResponse.json({
    ok: true,
    run: { ...run, input: safeInput, output: redactSecrets(asRecord(run.output)) },
    editorial: editorial ? { ...editorial, metadata: safeMetadata } : null,
    recovery: active.rows.some((row) => row.status === "queued" || row.status === "claimed")
      ? { ...decision, allowed: false, reason: "recovery_already_queued" }
      : draftOperation.rows[0]
      ? { ...decision, allowed: false, reason: `wp_draft_operation_${draftOperation.rows[0].status}` }
      : decision,
    recoveryEvents: active.rows,
    auditEvents: events.rows,
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const auth = requireAdminOrEditor(request);
  const denied = guardResponse(auth);
  if (denied) return denied;
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const { runId } = await ctx.params;
  const parsedId = IdSchema.safeParse({ runId });
  if (!parsedId.success) return NextResponse.json({ ok: false, error: "invalid_run_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }
  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });

  const result = await withTx(async (tx) => {
    const runResult = await tx.query<RunRow>(
      `SELECT id, workflow, status, input, output, editorial_item_id,
              stage, error_class, updated_at, recovery_count
         FROM automation_runs WHERE id = $1 FOR UPDATE`,
      [parsedId.data.runId],
    );
    const run = runResult.rows[0];
    if (!run) return { status: 404 as const, body: { ok: false, error: "run_not_found" } };
    if (!run.editorial_item_id) return { status: 409 as const, body: { ok: false, error: "editorial_link_missing" } };

    const editorialResult = await tx.query<EditorialRow>(
      `SELECT id, source_id, wp_post_id, stage, approval_state, rights_confirmed, metadata
         FROM editorial_items WHERE id = $1 FOR UPDATE`,
      [run.editorial_item_id],
    );
    const item = editorialResult.rows[0];
    if (!item || item.id !== run.editorial_item_id) {
      return { status: 409 as const, body: { ok: false, error: "editorial_link_mismatch" } };
    }

    const prior = await tx.query<{ active: boolean }>(
      `SELECT true AS active FROM automation_run_recoveries
        WHERE run_id = $1 AND status IN ('queued', 'claimed') LIMIT 1`,
      [run.id],
    );
    const draftOperation = await tx.query<DraftOperationRow>(
      `SELECT status, wp_post_id FROM wp_draft_operations WHERE run_id = $1 LIMIT 1`,
      [run.id],
    );
    const metadata = asRecord(item.metadata);
    const editorialContent = parsedBody.data.editorial ?? null;
    const hasContent = editorialContent
      ? true
      : hasEditorialContent(metadata);
    const decision = inspectRecovery({
      status: run.status,
      updatedAt: run.updated_at,
      stage: run.stage ?? item.stage,
      errorClass: run.error_class,
      recoveryCount: run.recovery_count,
      hasRunWpPostId: Boolean(asRecord(run.output).wp_post_id),
      editorialWpPostId: item.wp_post_id,
      approvalState: item.approval_state,
      editorialContentComplete: hasContent,
      hasActiveRecovery: prior.rows.length > 0,
    });
    const draftOp = draftOperation.rows[0];
    if (draftOp) {
      return { status: 409 as const, body: { ok: false, error: "recovery_refused", reason: `wp_draft_operation_${draftOp.status}`, interrupted: decision.interrupted } };
    }
    if (!decision.allowed) {
      return { status: 409 as const, body: { ok: false, error: "recovery_refused", reason: decision.reason, interrupted: decision.interrupted } };
    }

    if (parsedBody.data.dry_run) {
      return {
        status: 200 as const,
        body: {
          ok: true,
          dry_run: true,
          recovery_allowed: true,
          reason: decision.reason,
          interrupted: decision.interrupted,
          resume_stage: run.status === "held_for_content" ? "editorial_factory" : (run.stage ?? item.stage),
          attempt: decision.attempt + 1,
          backoff_ms: decision.backoffMs,
          editorial_content_required: run.status === "held_for_content" && !hasEditorialContent(metadata),
        },
      };
    }

    if (run.status === "held_for_content" && !editorialContent) {
      return { status: 400 as const, body: { ok: false, error: "editorial_content_required" } };
    }
    if (editorialContent) {
      const saved = {
        title_th: editorialContent.title_th,
        body_th: editorialContent.body_th,
        excerpt_th: editorialContent.excerpt_th ?? "",
        ...(editorialContent.slug ? { slug: editorialContent.slug } : {}),
        ...(editorialContent.news_type ? { news_type: editorialContent.news_type } : {}),
        editorial_completion: {
          source: "human_operator",
          completed_by: auth.ok ? auth.session.userId : null,
          completed_at: new Date().toISOString(),
        },
      };
      await tx.query(
        `UPDATE editorial_items
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [item.id, JSON.stringify(saved)],
      );
    }

    const resumeStage = run.status === "held_for_content" ? "editorial_factory" : (run.stage ?? item.stage);
    const queue = await tx.query<{ id: string; available_at: string }>(
      `INSERT INTO automation_run_recoveries
         (run_id, editorial_item_id, requested_by, reason, from_status, resume_stage, available_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7::bigint * interval '1 millisecond'))
       RETURNING id, available_at`,
      [run.id, item.id, auth.ok ? auth.session.userId : null, parsedBody.data.reason, run.status, resumeStage, decision.backoffMs],
    );
    const recoveryId = queue.rows[0]?.id;
    if (!recoveryId) throw new Error("recovery_queue_insert_failed");
    await tx.query(
      `UPDATE automation_runs
          SET status = 'recovery_queued',
              stage = $2,
              recovery_count = recovery_count + 1,
              updated_at = now()
        WHERE id = $1 AND status = $3`,
      [run.id, resumeStage, run.status],
    );
    await tx.query(
      `INSERT INTO audit_logs
         (actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'run_recovery_queued', 'automation_run', $2, $3::jsonb)`,
      [
        auth.ok ? auth.session.userId : null,
        run.id,
        JSON.stringify(redactSecrets({ recovery_id: recoveryId, reason: parsedBody.data.reason, resume_stage: resumeStage, attempt: decision.attempt + 1 })),
      ],
    );
    return {
      status: 202 as const,
      body: {
        ok: true,
        dry_run: false,
        recovery_id: recoveryId,
        status: "recovery_queued",
        resume_stage: resumeStage,
        available_at: queue.rows[0].available_at,
        launch_payload: { recovery_id: recoveryId },
      },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasEditorialContent(metadata: Record<string, unknown>): boolean {
  return typeof metadata.title_th === "string" && metadata.title_th.trim().length > 0 &&
    typeof metadata.body_th === "string" && metadata.body_th.trim().length >= 200;
}
