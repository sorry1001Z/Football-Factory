// Football Factory — retry policy (R2 Wave 2C).
//
// Pure decision table. No I/O. No throws. Returns a discriminated
// result so the retry route can map cleanly to a 200 / 409 response
// WITHOUT touching the database unless the policy approves it.
//
// Philosophy:
//   Retry is ONLY for transient failures of a single step in the
//   canonical pipeline. Retry MUST NOT bypass:
//     - fact review
//     - rights review
//     - approval
//     - stage adjacency
//     - WP post ownership / linkage
//   Retry MUST NOT jump directly to publish.
//   Retry MUST NOT create a duplicate editorial item.
//
// Allowed retry cases (transient):
//   - status = "running" + stage at a non-terminal pre-approval
//     step + errorClass = "timeout" | "network" |
//     "upstream_temporary" | "wp_retryable".
//   - status = "failed" but stage is non-terminal and errorClass
//     matches one of the transient classes.
//
// Forbidden retry cases (permanent):
//   - approval_state = "rejected" → retry rejected
//   - rights_confirmed = false AND stage past rights_check → retry
//     blocked (must clear rights first)
//   - stage = "rejected" | "failed" | "published" → terminal
//   - errorClass = "auth" | "validation" | "rights_rejected" |
//     "approval_rejected" | "association_mismatch" |
//     "ownership_mismatch" → permanent, no retry

import type { EditorialStage } from "@/lib/auth/stage-machine";

export type ErrorClass =
  | "timeout"
  | "network"
  | "upstream_temporary"
  | "wp_retryable"
  | "auth"
  | "validation"
  | "rights_rejected"
  | "approval_rejected"
  | "association_mismatch"
  | "ownership_mismatch"
  | "unknown";

export type RunStatus =
  | "running"
  | "success"
  | "failed"
  | "waiting_approval"
  | "rejected";

export type ApprovalState = "pending" | "approved" | "rejected";

export interface RetryDecision {
  allowed: boolean;
  reason: string;
  nextAction?: RetryNextAction;
}

export type RetryNextAction =
  | { kind: "noop" }
  // Re-run the current stage from scratch (the run has not moved
  // beyond the current stage in the canonical pipeline).
  | { kind: "rerun_stage"; stage: EditorialStage; runId: string }
  // Continue to the NEXT stage (only when the current stage is
  // already marked completed in metadata).
  | { kind: "advance_stage"; fromStage: EditorialStage; runId: string };

const TERMINAL: ReadonlySet<EditorialStage> = new Set<EditorialStage>([
  "rejected",
  "failed",
  "published",
]);

const TRANSIENT_ERRORS: ReadonlySet<ErrorClass> = new Set<ErrorClass>([
  "timeout",
  "network",
  "upstream_temporary",
  "wp_retryable",
]);

const PERMANENT_ERRORS: ReadonlySet<ErrorClass> = new Set<ErrorClass>([
  "auth",
  "validation",
  "rights_rejected",
  "approval_rejected",
  "association_mismatch",
  "ownership_mismatch",
]);

/**
 * Decide whether a retry is allowed for a given (stage, status,
 * errorClass, approval, rights) tuple. Pure; no DB calls.
 *
 * IMPORTANT: this function NEVER throws. Returns a discriminated
 * result the route can map to either a 200 (allowed) or a 409
 * (refused, with reason).
 */
export function canRetry(input: {
  stage: string;
  status: RunStatus;
  errorClass: ErrorClass;
  approvalState: ApprovalState;
  rightsConfirmed: boolean;
  runId: string;
}): RetryDecision {
  // 1. Terminal stages → never retry.
  if (
    input.stage === "rejected" ||
    input.stage === "failed" ||
    input.stage === "published"
  ) {
    return { allowed: false, reason: "terminal_state_no_retry" };
  }

  // 2. Approval rejected → never retry (must re-clear via admin).
  if (input.approvalState === "rejected") {
    return { allowed: false, reason: "approval_rejected_no_retry" };
  }

  // 3. Rights past rights_check but not cleared → block retry.
  //    The human must clear rights first.
  if (
    !input.rightsConfirmed &&
    (input.stage === "seo_check" ||
      input.stage === "draft_created" ||
      input.stage === "waiting_approval" ||
      input.stage === "approved")
  ) {
    return { allowed: false, reason: "rights_unconfirmed_no_retry" };
  }

  // 4. Permanent error class → no retry.
  if (PERMANENT_ERRORS.has(input.errorClass)) {
    return {
      allowed: false,
      reason: `permanent_error_class_${input.errorClass}_no_retry`,
    };
  }

  // 5. Status: only running/failed are retry-eligible. success /
  //    waiting_approval / rejected should not be retried.
  if (
    input.status !== "running" &&
    input.status !== "failed"
  ) {
    return {
      allowed: false,
      reason: `status_${input.status}_not_retryable`,
    };
  }

  // 6. Transient error required for retry.
  if (!TRANSIENT_ERRORS.has(input.errorClass)) {
    return {
      allowed: false,
      reason:
        input.errorClass === "unknown"
          ? "unknown_error_no_retry"
          : `error_class_${input.errorClass}_not_transient`,
    };
  }

  // 7. Stage-specific policy: only certain pre-approval stages are
  //    retry-eligible. Waiting approval / approved / published are
  //    explicitly NOT retry targets (the human must act, not a
  //    retry).
  if (input.stage === "waiting_approval" || input.stage === "approved") {
    return {
      allowed: false,
      reason: `stage_${input.stage}_needs_human_action_not_retry`,
    };
  }

  // 8. Allowed: re-run the current stage.
  return {
    allowed: true,
    reason: "transient_error_retryable",
    nextAction: {
      kind: "rerun_stage",
      stage: input.stage as EditorialStage,
      runId: input.runId,
    },
  };
}

/**
 * Returns the canonical next stage for a given (stage, status)
 * pair, ONLY when the current stage is already complete. Used by
 * the retry executor when `nextAction.kind === "advance_stage"`.
 */
export function nextStageIfComplete(currentStage: string): EditorialStage | null {
  const map: Partial<Record<EditorialStage, EditorialStage>> = {
    ingested: "editorial_created",
    editorial_created: "ai_assist",
    ai_assist: "fact_check",
    fact_check: "rights_check",
    rights_check: "seo_check",
    seo_check: "draft_created",
    draft_created: "waiting_approval",
    waiting_approval: "approved",
    approved: "published",
  };
  if (
    currentStage === "rejected" ||
    currentStage === "failed" ||
    currentStage === "published"
  ) {
    return null;
  }
  return map[currentStage as EditorialStage] ?? null;
}
