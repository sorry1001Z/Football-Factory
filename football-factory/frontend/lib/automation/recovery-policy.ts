import type { ErrorClass, RunStatus } from "./retry-policy";

export const RUN_STALE_AFTER_MS = 30 * 60 * 1000;
export const MAX_RECOVERY_ATTEMPTS = 3;
export const RECOVERY_BACKOFF_BASE_MS = 30 * 1000;
export const RECOVERY_BACKOFF_MAX_MS = 15 * 60 * 1000;

export type RecoveryInspectionInput = {
  status: RunStatus;
  updatedAt: string | Date;
  stage: string | null;
  errorClass: ErrorClass | null;
  recoveryCount: number;
  now?: number;
  hasRunWpPostId: boolean;
  editorialWpPostId: number | null;
  approvalState: "pending" | "approved" | "rejected";
  editorialContentComplete: boolean;
  hasActiveRecovery?: boolean;
};

export type RecoveryDecision = {
  allowed: boolean;
  reason: string;
  interrupted: boolean;
  attempt: number;
  backoffMs: number;
};

export function recoveryBackoffMs(attempt: number): number {
  const exponent = Math.max(0, Math.min(10, Math.trunc(attempt)));
  return Math.min(RECOVERY_BACKOFF_MAX_MS, RECOVERY_BACKOFF_BASE_MS * 2 ** exponent);
}

export function classifyHttpFailure(status: number): ErrorClass {
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || (status >= 400 && status < 500 && status !== 408 && status !== 429)) {
    return "validation";
  }
  if (status === 408 || status === 429 || status >= 500) return "upstream_temporary";
  return "unknown";
}

export function inspectRecovery(input: RecoveryInspectionInput): RecoveryDecision {
  const now = input.now ?? Date.now();
  const updatedAt = input.updatedAt instanceof Date
    ? input.updatedAt.getTime()
    : Date.parse(input.updatedAt);
  const interrupted = input.status === "running" &&
    Number.isFinite(updatedAt) && now - updatedAt >= RUN_STALE_AFTER_MS;
  const attempt = Math.max(0, Math.trunc(input.recoveryCount));
  const result = (allowed: boolean, reason: string, backoffMs = 0): RecoveryDecision => ({
    allowed,
    reason,
    interrupted,
    attempt,
    backoffMs,
  });

  if (input.status === "success" || input.status === "waiting_approval" || input.status === "rejected") {
    return result(false, "completed_or_human_review_run_protected");
  }
  if (input.approvalState === "approved" || input.approvalState === "rejected") {
    return result(false, "approval_state_protected");
  }
  if (input.hasRunWpPostId || input.editorialWpPostId !== null) {
    return result(false, "wordpress_post_already_exists");
  }
  if (["draft_creating", "draft_created", "waiting_approval", "approved", "published"].includes(input.stage ?? "")) {
    return result(false, "draft_or_terminal_stage_protected");
  }
  if (input.hasActiveRecovery || input.status === "recovery_queued") {
    return result(false, "recovery_already_queued");
  }
  if (attempt >= MAX_RECOVERY_ATTEMPTS) {
    return result(false, "recovery_attempt_limit_reached");
  }
  if (input.status === "held_for_content") {
    return input.editorialContentComplete
      ? result(true, "editorial_content_ready")
      : result(false, "editorial_content_required");
  }
  if (input.status === "running" && !interrupted) {
    return result(false, "run_is_active");
  }
  if (input.status !== "failed" && input.status !== "running") {
    return result(false, `status_${input.status}_not_recoverable`);
  }
  if (input.status === "failed" && !["timeout", "network", "upstream_temporary", "wp_retryable"].includes(input.errorClass ?? "")) {
    return result(false, "non_transient_failure_not_retryable");
  }
  if (input.errorClass === "auth" || input.errorClass === "validation") {
    return result(false, `permanent_http_error_${input.errorClass}`);
  }
  return result(true, interrupted ? "interrupted_run_recoverable" : "transient_failure_recoverable", recoveryBackoffMs(attempt));
}
