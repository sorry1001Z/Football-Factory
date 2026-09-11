// Tests for the stage machine (PRE-N8N BACKEND).

import test from "node:test";
import assert from "node:assert/strict";
import {
  EDITORIAL_STAGES,
  canTransition,
  assertTransition,
  isEditorialStage,
  StageTransitionError,
  stageIndex,
} from "@/lib/auth/stage-machine";

test("stage-machine: EDITORIAL_STAGES includes the canonical 12-stage set", () => {
  assert.equal(EDITORIAL_STAGES.length, 12);
  for (const s of [
    "ingested",
    "editorial_created",
    "ai_assist",
    "fact_check",
    "rights_check",
    "seo_check",
    "draft_created",
    "waiting_approval",
    "approved",
    "published",
    "rejected",
    "failed",
  ]) {
    assert.ok((EDITORIAL_STAGES as readonly string[]).includes(s), `missing ${s}`);
  }
});

test("stage-machine: isEditorialStage rejects unknown values", () => {
  assert.equal(isEditorialStage("editorial_created"), true);
  assert.equal(isEditorialStage("PUBLISHED"), false); // case-sensitive
  assert.equal(isEditorialStage(""), false);
  assert.equal(isEditorialStage("random_stage"), false);
});

test("stage-machine: stageIndex returns increasing ordinals along the canonical path", () => {
  assert.equal(stageIndex("ingested"), 0);
  assert.equal(stageIndex("editorial_created"), 1);
  assert.equal(stageIndex("ai_assist"), 2);
  assert.equal(stageIndex("approved"), 8);
  assert.equal(stageIndex("published"), 9);
  assert.equal(stageIndex("rejected"), 10);
  assert.equal(stageIndex("not_a_stage"), null);
});

test("stage-machine: canTransition — same stage is allowed (idempotent)", () => {
  for (const s of EDITORIAL_STAGES) {
    assert.equal(canTransition(s, s), true, `${s} → ${s}`);
  }
});

test("stage-machine: canTransition — forward along canonical path is allowed", () => {
  const forward = [
    ["ingested", "editorial_created"],
    ["editorial_created", "ai_assist"],
    ["ai_assist", "fact_check"],
    ["fact_check", "rights_check"],
    ["rights_check", "seo_check"],
    ["seo_check", "draft_created"],
    ["draft_created", "waiting_approval"],
    ["waiting_approval", "approved"],
    ["approved", "published"],
  ] as const;
  for (const [a, b] of forward) {
    assert.equal(canTransition(a, b), true, `${a} → ${b}`);
  }
});

test("stage-machine: canTransition — backward is rejected", () => {
  assert.equal(canTransition("ai_assist", "editorial_created"), false);
  assert.equal(canTransition("approved", "waiting_approval"), false);
  assert.equal(canTransition("published", "approved"), false);
});

test("stage-machine: terminal states cannot transition forward or backward", () => {
  assert.equal(canTransition("rejected", "approved"), false);
  assert.equal(canTransition("rejected", "editorial_created"), false);
  assert.equal(canTransition("failed", "approved"), false);
  // Published is also terminal from a pipeline standpoint.
  assert.equal(canTransition("published", "approved"), false);
});

test("stage-machine: non-terminal stages can move to failed/rejected (admin error path)", () => {
  for (const s of [
    "ingested",
    "editorial_created",
    "ai_assist",
    "fact_check",
    "rights_check",
    "seo_check",
    "draft_created",
    "waiting_approval",
  ]) {
    assert.equal(canTransition(s, "failed"), true, `${s} → failed`);
    assert.equal(canTransition(s, "rejected"), true, `${s} → rejected`);
  }
});

test("stage-machine: assertTransition throws StageTransitionError for invalid moves", () => {
  assert.throws(
    () => assertTransition("rejected", "approved"),
    (e: unknown) => e instanceof StageTransitionError && e.code === "terminal_state",
  );
  assert.throws(
    () => assertTransition("published", "approved"),
    (e: unknown) => e instanceof StageTransitionError && e.code === "terminal_state",
  );
  assert.throws(
    () => assertTransition("ai_assist", "ingested"),
    (e: unknown) =>
      e instanceof StageTransitionError && e.code === "invalid_stage_transition",
  );
  assert.throws(
    () => assertTransition("ai_assist", "no_such_stage"),
    (e: unknown) => e instanceof StageTransitionError && e.code === "invalid_stage",
  );
});

test("stage-machine: assertTransition is a no-op when called with non-canonical starting stage", () => {
  // If a row has been hand-edited to "custom_stage", we accept any
  // canonical forward or terminal move (defensive default).
  assert.doesNotThrow(() => assertTransition("custom_stage", "ingested"));
});

test("stage-machine: skip transitions are rejected (no fan-out forward steps)", () => {
  assert.equal(canTransition("editorial_created", "fact_check"), false);
  assert.equal(canTransition("ai_assist", "rights_check"), false);
  assert.equal(canTransition("seo_check", "approved"), false);
});
