// Football Factory — SEO V3 publish-gate tests (Wave A).

import { test } from "node:test";
import assert from "node:assert/strict";
import { publishSeoGate } from "../publish-gate";

test("publish gate: pass", () => {
  const r = publishSeoGate({ score: 90, blockingIssues: [], warnings: [] });
  assert.equal(r.pass, true);
  assert.equal(r.score, 90);
  assert.deepEqual(r.blockingReasons, []);
});

test("publish gate: blocks on blocking issue", () => {
  const r = publishSeoGate({ score: 100, blockingIssues: ["X"], warnings: [] });
  assert.equal(r.pass, false);
  assert.deepEqual(r.blockingReasons, ["X"]);
});

test("publish gate: warnings not blocking reasons", () => {
  const r = publishSeoGate({ score: 90, blockingIssues: [], warnings: ["W"] });
  assert.equal(r.pass, true);
  assert.deepEqual(r.blockingReasons, []);
  assert.deepEqual(r.warnings, ["W"]);
});

test("publish gate: low score fails even with no blocking issues", () => {
  const r = publishSeoGate({ score: 50, blockingIssues: [], warnings: [] });
  assert.equal(r.pass, false);
});

test("publish gate: policyVersion honored", () => {
  const r = publishSeoGate({ score: 90 }, { policyVersion: "r2" });
  assert.equal(r.policyVersion, "r2");
});

test("publish gate: pagePolicy can add blockingReasons", () => {
  const r = publishSeoGate(
    { score: 90, blockingIssues: [] },
    {
      pagePolicy: () => ({ blockingReasons: ["X"], warnings: [] }),
    },
  );
  assert.equal(r.pass, false);
  assert.deepEqual(r.blockingReasons, ["X"]);
});

test("publish gate: pagePolicy can add warnings only", () => {
  const r = publishSeoGate(
    { score: 90 },
    {
      pagePolicy: () => ({ blockingReasons: [], warnings: ["W2"] }),
    },
  );
  assert.equal(r.pass, true);
  assert.deepEqual(r.warnings, ["W2"]);
});

test("publish gate: custom minScore", () => {
  const r = publishSeoGate(
    { score: 80, blockingIssues: [] },
    { minScore: 85 },
  );
  assert.equal(r.pass, false);
});
