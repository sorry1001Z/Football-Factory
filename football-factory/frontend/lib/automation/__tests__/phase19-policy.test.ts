import test from "node:test";
import assert from "node:assert/strict";
import { inspectRecovery, recoveryBackoffMs, classifyHttpFailure } from "@/lib/automation/recovery-policy";
import { canTransitionRun } from "@/lib/automation/run-lifecycle";
import { canUploadEditorialImage } from "@/lib/automation/rights-policy";
import { decideWpDraft } from "@/lib/automation/wp-draft-idempotency";

const common = {
  updatedAt: "2026-09-24T00:00:00.000Z",
  stage: "editorial_factory",
  errorClass: null,
  recoveryCount: 0,
  hasRunWpPostId: false,
  editorialWpPostId: null,
  approvalState: "pending" as const,
  editorialContentComplete: false,
  now: Date.parse("2026-09-24T01:00:00.000Z"),
};

test("Phase 19 recovery requires human content for held runs and bounds attempts", () => {
  assert.equal(inspectRecovery({ ...common, status: "held_for_content" }).reason, "editorial_content_required");
  const ready = inspectRecovery({ ...common, status: "held_for_content", editorialContentComplete: true });
  assert.equal(ready.allowed, true);
  assert.equal(ready.reason, "editorial_content_ready");
  assert.equal(ready.backoffMs, 0, "human completion can dispatch immediately once saved");
  assert.equal(inspectRecovery({ ...common, status: "failed", errorClass: "auth" }).allowed, false);
  assert.equal(inspectRecovery({ ...common, status: "failed", errorClass: "upstream_temporary", hasRunWpPostId: true }).reason, "wordpress_post_already_exists");
  assert.equal(inspectRecovery({ ...common, status: "failed", errorClass: "upstream_temporary", recoveryCount: 3 }).reason, "recovery_attempt_limit_reached");
  assert.equal(inspectRecovery({ ...common, status: "running" }).reason, "interrupted_run_recoverable");
});

test("Phase 19 retry classes and exponential backoff are bounded", () => {
  assert.equal(classifyHttpFailure(400), "validation");
  assert.equal(classifyHttpFailure(401), "auth");
  assert.equal(classifyHttpFailure(500), "upstream_temporary");
  assert.equal(recoveryBackoffMs(0), 30_000);
  assert.equal(recoveryBackoffMs(1), 60_000);
  assert.equal(recoveryBackoffMs(20), 15 * 60_000);
});

test("Phase 19 lifecycle prevents held, failed, or recovery states from skipping gates", () => {
  assert.equal(canTransitionRun("running", "held_for_content"), true);
  assert.equal(canTransitionRun("held_for_content", "recovery_queued"), true);
  assert.equal(canTransitionRun("recovery_queued", "running"), true);
  assert.equal(canTransitionRun("held_for_content", "waiting_approval"), false);
  assert.equal(canTransitionRun("failed", "waiting_approval"), false);
  assert.equal(canTransitionRun("waiting_approval", "success"), true);
});

test("Phase 19 image policy allows only explicitly cleared, attributed rights", () => {
  const valid = {
    rightsConfirmed: true,
    rights: {
      state: "cleared",
      source_url: "https://images.example/source",
      source_name: "Example Archive",
      license_name: "CC BY 4.0",
      license_url: "https://creativecommons.org/licenses/by/4.0/",
      attribution_text: "Photo by Example Archive",
      commercial_use_confirmed: true,
    },
  };
  assert.equal(canUploadEditorialImage(valid), true);
  assert.equal(canUploadEditorialImage({ ...valid, rightsConfirmed: false }), false);
  assert.equal(canUploadEditorialImage({ ...valid, rights: { ...valid.rights, state: "manual_review" } }), false);
  assert.equal(canUploadEditorialImage({ ...valid, rights: { ...valid.rights, license_name: "" } }), false);
  assert.equal(canUploadEditorialImage({ ...valid, rights: { ...valid.rights, license_url: "" } }), false);
  assert.equal(canUploadEditorialImage({ ...valid, rights: { ...valid.rights, attribution_text: "" } }), false);
  assert.equal(canUploadEditorialImage({ ...valid, rights: { ...valid.rights, source_url: "javascript:alert(1)" } }), false);
});

test("Phase 19 draft identity is preserved and run linkage cannot be switched", () => {
  const reusable = decideWpDraft({ wp_post_id: 77 }, "editorial-1", "editorial-1");
  assert.equal(reusable.ok && reusable.reuse, true);
  assert.equal(reusable.ok && reusable.reuse ? reusable.wp_post_id : null, 77);
  const conflict = decideWpDraft({}, "editorial-1", "editorial-2");
  assert.equal(conflict.ok, false);
  assert.equal(conflict.ok ? "" : conflict.error, "linkage_conflict");
});
