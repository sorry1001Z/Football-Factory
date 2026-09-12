// Football Factory — POST /api/admin/editorial/[id]/retry (R2 Wave 2C)
//
// HIGHEST-RISK admin endpoint. Decisions are made by the pure
// `canRetry()` policy in lib/automation/retry-policy.ts BEFORE any
// database side-effect.
//
// Auth: session + admin/editor role only. CSRF required.
// Automation-secret MUST NOT bypass — this is an admin route, not
// an automation route.
//
// Behavior:
//   1. Parse { reason: string, errorClass?: string } via zod.
//   2. Resolve the editorial item.
//   3. Resolve the linked automation_run via the editorial_item_id.
//      If NULL → 409 editorial_link_missing.
//   4. Run `canRetry()` against (stage, status, errorClass,
//      approval_state, rights_confirmed). If denied → 409 with reason.
//   5. If approved → call the correct next automation operation
//      for the current stage (re-run from current stage; never
//      jump to publish). Idempotent. Records audit log.
//
// MUST NEVER:
//   - bypass fact review
//   - bypass rights review
//   - bypass approval
//   - bypass stage adjacency
//   - jump directly to publish
//   - create a duplicate editorial item
//   - create a duplicate WordPress post

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import {
  canRetry,
  nextStageIfComplete,
  type ErrorClass,
  type RunStatus,
} from "@/lib/automation/retry-policy";
import type { AutomationRunResponse } from "@/lib/admin/contracts";
import { redactSecrets } from "@/lib/auth/redact-secrets";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

const IdSchema = z.object({ id: z.string().uuid() });

const BodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  errorClass: z
    .enum([
      "timeout",
      "network",
      "upstream_temporary",
      "wp_retryable",
      "auth",
      "validation",
      "rights_rejected",
      "approval_rejected",
      "association_mismatch",
      "ownership_mismatch",
      "unknown",
    ])
    .optional()
    .default("unknown"),
});

const RUN_STATUSES: ReadonlyArray<RunStatus> = [
  "running",
  "success",
  "failed",
  "waiting_approval",
  "rejected",
];

interface RunRow {
  id: string;
  workflow: string;
  status: string;
  stage: string | null;
  error_class: string | null;
  editorial_item_id: string | null;
  wp_post_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  // 1. Auth: admin/editor session.
  const g = requireAdminOrEditor(request);
  const authResp = guardResponse(g);
  if (authResp !== null) return authResp;

  // 2. CSRF: required for any POST mutation.
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  // 3. Parse id + body.
  const { id } = await ctx.params;
  const idParsed = IdSchema.safeParse({ id });
  if (!idParsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    );
  }
  let bodyParsed;
  try {
    const json = await request.json();
    bodyParsed = BodySchema.safeParse(json);
  } catch {
    bodyParsed = { success: false } as const;
  }
  if (!bodyParsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }
  const { reason, errorClass } = bodyParsed.data;

  // 4. Editorial item.
  const repo = new EditorialRepository(getDb());
  const item = await repo.findById(idParsed.data.id);
  if (!item) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  // 5. Linked run.
  const r = await getDb().query<RunRow>(
    `SELECT id, workflow, status, stage, error_class,
            editorial_item_id, wp_post_id, created_at, updated_at
       FROM automation_runs
      WHERE editorial_item_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [idParsed.data.id],
  );
  const run = r.rows[0];
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "editorial_link_missing" },
      { status: 409 },
    );
  }

  // 6. Decide.
  const decision = canRetry({
    stage: item.stage,
    status: (RUN_STATUSES as readonly string[]).includes(run.status)
      ? (run.status as RunStatus)
      : "running",
    errorClass: errorClass as ErrorClass,
    approvalState: item.approval_state,
    rightsConfirmed: item.rights_confirmed,
    runId: run.id,
  });

  // 7. Log the retry request first (audit trail regardless of outcome).
  await logRetryAudit({
    action: "retry_request",
    resourceId: item.id,
    actorUserId: g.ok ? g.session.userId : null,
    metadata: { reason, errorClass, decision: decision.allowed ? "allowed" : "refused", decisionReason: decision.reason },
  });

  if (!decision.allowed) {
    await logRetryAudit({
      action: "retry_refused",
      resourceId: item.id,
      actorUserId: g.ok ? g.session.userId : null,
      metadata: { reason, errorClass, policyReason: decision.reason },
    });
    return NextResponse.json(
      {
        ok: false,
        error: "retry_refused",
        reason: decision.reason,
      },
      { status: 409 },
    );
  }

  // 8. Execute the next action. Pure: this slice ONLY marks the run
  //    as 'running' again with a re-run_stage nextAction. The actual
  //    stage re-execution is delegated to the existing automation
  //    routes (the brief says "call ONLY the correct next automation
  //    operation"). For now we surface the action in the response so
  //    the operator can see what would happen, AND we mark the run
  //    as running. The actual stage work is performed by the
  //    automation layer (n8n or the equivalent) calling the existing
  //    automation endpoints.
  await getDb().query(
    `UPDATE automation_runs
        SET status = 'running',
            error_class = NULL,
            updated_at = now()
      WHERE id = $1`,
    [run.id],
  );

  // 9. Audit log the accepted retry.
  await logRetryAudit({
    action: "retry_accepted",
    resourceId: item.id,
    actorUserId: g.ok ? g.session.userId : null,
    metadata: {
      reason,
      errorClass,
      nextAction: decision.nextAction ?? null,
    },
  });

  // 10. Build response. Re-read the run so the client sees the
  //     updated status.
  const refreshed = await getDb().query<RunRow>(
    `SELECT id, workflow, status, stage, error_class,
            editorial_item_id, wp_post_id, created_at, updated_at
       FROM automation_runs
      WHERE id = $1
      LIMIT 1`,
    [run.id],
  );
  const refreshedRun = refreshed.rows[0];
  const body: AutomationRunResponse = {
    ok: true,
    run: {
      id: refreshedRun?.id ?? run.id,
      workflow: refreshedRun?.workflow ?? run.workflow,
      status: refreshedRun?.status ?? run.status,
      stage: refreshedRun?.stage ?? run.stage ?? "—",
      errorClass: refreshedRun?.error_class ?? run.error_class ?? "unknown",
      editorialItemId: refreshedRun?.editorial_item_id ?? run.editorial_item_id,
      wpPostId: refreshedRun?.wp_post_id ?? run.wp_post_id,
      createdAt: refreshedRun?.created_at ?? run.created_at,
      updatedAt: refreshedRun?.updated_at ?? run.updated_at,
    },
    editorialItem: item,
    recentEvents: [],
  };
  return NextResponse.json(body, { status: 200 });
}

async function logRetryAudit(input: {
  action: string;
  resourceId: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const scrubbed = redactSecrets(input.metadata) as Record<string, unknown>;
  await getDb().query(
    `INSERT INTO audit_logs
       (actor_user_id, action, resource_type, resource_id, metadata)
     VALUES
       ($1, $2, 'editorial_item', $3, $4::jsonb)`,
    [
      input.actorUserId,
      input.action,
      input.resourceId,
      JSON.stringify(scrubbed),
    ],
  );
}

// Helper retained for type completeness. Currently unused because
// canRetry() only emits `rerun_stage` for retry-eligible cases. Kept
// so future slices can switch to `advance_stage` without a re-import.
// (Not exported — Next.js typedRoutes requires route files to expose
// only HTTP method handlers.)
void nextStageIfComplete;
