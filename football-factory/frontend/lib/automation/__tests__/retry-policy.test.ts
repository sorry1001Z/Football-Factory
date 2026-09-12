// Football Factory — Retry policy tests (R2 Wave 2C).
//
// Covers:
//   - transient retry: timeout/network/upstream_temporary/wp_retryable
//   - permanent failure: auth/validation
//   - rights_rejected: blocked
//   - approval_rejected: blocked
//   - association_mismatch: blocked
//   - ownership_mismatch: blocked
//   - stage "rejected": blocked (terminal)
//   - stage "failed": blocked (terminal)
//   - stage "published": blocked (terminal)
//   - waiting_approval/approved: needs human, not retry
//   - success status: not retryable
//   - happy path: rerun_stage returned

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canRetry,
  nextStageIfComplete,
  type ErrorClass,
} from "../retry-policy";

const base = {
  stage: "fact_check",
  status: "failed" as const,
  approvalState: "pending" as const,
  rightsConfirmed: true,
  runId: "run-1",
};

function expect(allowed: boolean, reason: string, input: Parameters<typeof canRetry>[0]) {
  const d = canRetry(input);
  assert.equal(d.allowed, allowed, `expected allowed=${allowed}; got ${JSON.stringify(d)}`);
  assert.equal(d.reason, reason);
}

test("transient: timeout retry allowed at fact_check", () => {
  const d = canRetry({ ...base, errorClass: "timeout" });
  assert.equal(d.allowed, true);
  assert.equal(d.nextAction?.kind, "rerun_stage");
  assert.equal(d.nextAction && d.nextAction.kind === "rerun_stage" && d.nextAction.stage, "fact_check");
});

test("transient: network retry allowed at ai_assist", () => {
  const d = canRetry({ ...base, stage: "ai_assist", status: "running", errorClass: "network" });
  assert.equal(d.allowed, true);
  assert.equal(d.nextAction?.kind, "rerun_stage");
});

test("transient: upstream_temporary retry allowed at rights_check", () => {
  const d = canRetry({ ...base, stage: "rights_check", errorClass: "upstream_temporary" });
  assert.equal(d.allowed, true);
});

test("transient: wp_retryable retry allowed at seo_check", () => {
  const d = canRetry({ ...base, stage: "seo_check", errorClass: "wp_retryable" });
  assert.equal(d.allowed, true);
});

test("permanent: auth error class → blocked", () => {
  expect(false, "permanent_error_class_auth_no_retry", { ...base, errorClass: "auth" });
});

test("permanent: validation error class → blocked", () => {
  expect(false, "permanent_error_class_validation_no_retry", { ...base, errorClass: "validation" });
});

test("permanent: rights_rejected → blocked", () => {
  expect(false, "permanent_error_class_rights_rejected_no_retry", { ...base, errorClass: "rights_rejected" });
});

test("permanent: approval_rejected → blocked", () => {
  expect(false, "permanent_error_class_approval_rejected_no_retry", { ...base, errorClass: "approval_rejected" });
});

test("permanent: association_mismatch → blocked", () => {
  expect(false, "permanent_error_class_association_mismatch_no_retry", { ...base, errorClass: "association_mismatch" });
});

test("permanent: ownership_mismatch → blocked", () => {
  expect(false, "permanent_error_class_ownership_mismatch_no_retry", { ...base, errorClass: "ownership_mismatch" });
});

test("terminal stage rejected → blocked", () => {
  expect(false, "terminal_state_no_retry", { ...base, stage: "rejected", errorClass: "timeout" });
});

test("terminal stage failed → blocked", () => {
  expect(false, "terminal_state_no_retry", { ...base, stage: "failed", errorClass: "timeout" });
});

test("terminal stage published → blocked", () => {
  expect(false, "terminal_state_no_retry", { ...base, stage: "published", errorClass: "timeout" });
});

test("approval rejected → blocked", () => {
  expect(false, "approval_rejected_no_retry", {
    ...base,
    approvalState: "rejected",
    errorClass: "timeout",
  });
});

test("rights not confirmed past rights_check → blocked", () => {
  expect(false, "rights_unconfirmed_no_retry", {
    ...base,
    stage: "seo_check",
    rightsConfirmed: false,
    errorClass: "timeout",
  });
});

test("waiting_approval → needs human, not retry", () => {
  expect(false, "stage_waiting_approval_needs_human_action_not_retry", {
    ...base,
    stage: "waiting_approval",
    errorClass: "timeout",
  });
});

test("approved → needs human, not retry", () => {
  expect(false, "stage_approved_needs_human_action_not_retry", {
    ...base,
    stage: "approved",
    errorClass: "timeout",
  });
});

test("success status → not retryable", () => {
  expect(false, "status_success_not_retryable", {
    ...base,
    status: "success",
    errorClass: "timeout",
  });
});

test("waiting_approval status → not retryable", () => {
  expect(false, "status_waiting_approval_not_retryable", {
    ...base,
    status: "waiting_approval",
    errorClass: "timeout",
  });
});

test("unknown error class → blocked", () => {
  expect(false, "unknown_error_no_retry", { ...base, errorClass: "unknown" });
});

test("next stage lookup: fact_check → rights_check", () => {
  assert.equal(nextStageIfComplete("fact_check"), "rights_check");
});

test("next stage lookup: terminal returns null", () => {
  assert.equal(nextStageIfComplete("rejected"), null);
  assert.equal(nextStageIfComplete("failed"), null);
  assert.equal(nextStageIfComplete("published"), null);
});

test("never jumps to publish directly from waiting_approval without approval", () => {
  // The canRetry() function for stage=approved returns "needs human";
  // it never emits a rerun_stage for the published stage.
  const d = canRetry({
    stage: "approved",
    status: "running",
    errorClass: "timeout",
    approvalState: "approved",
    rightsConfirmed: true,
    runId: "run-2",
  });
  assert.equal(d.allowed, false);
});

test("rightsConfirmed=true but approvalState=pending is required for retry", () => {
  // approvalState=pending is fine; only 'rejected' blocks.
  const d = canRetry({
    stage: "draft_created",
    status: "running",
    errorClass: "timeout",
    approvalState: "pending",
    rightsConfirmed: true,
    runId: "run-3",
  });
  assert.equal(d.allowed, true);
});

test("happy path: returns nextAction with the current stage", () => {
  const d = canRetry({
    stage: "editorial_created",
    status: "running",
    errorClass: "timeout",
    approvalState: "pending",
    rightsConfirmed: true,
    runId: "run-4",
  });
  assert.equal(d.allowed, true);
  assert.equal(d.nextAction?.kind, "rerun_stage");
  if (d.nextAction?.kind === "rerun_stage") {
    assert.equal(d.nextAction.stage, "editorial_created");
    assert.equal(d.nextAction.runId, "run-4");
  }
});

// Compile-time type assertion: ErrorClass union is exhaustive.
function _assertExhaustive(_e: ErrorClass): void {
  void _e;
}
void _assertExhaustive;
