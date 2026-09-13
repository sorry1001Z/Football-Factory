// Football Factory — Wave C (Admin Automation) + Wave D (SEO
// Suggestions) view-model tests.
//
// 22 cases for Wave C + 21 cases for Wave D, mirroring the
// Pack 3 / Pack 4 audit + the production invariants.

import { test } from "node:test";
import assert from "node:assert/strict";

// ----- Wave C imports ---------------------------------------------------

import {
  filterRuns,
  healthSummary,
  mutationCapabilities as adminMutationCapabilities,
  retryUiContract,
  stageTimeline,
  STAGES,
  viewState,
  normalizeRun,
} from "../../automation/view-model";
import type { RawRun } from "../../automation/view-model";

// ----- Wave D imports ---------------------------------------------------

import {
  buildSeoOverview,
  gscModel,
  GSC_OPPORTUNITY_TYPES,
  identityStatusFor,
  intentModel,
  internalLinksModel,
  mutationCapabilities as seoMutationCapabilities,
  panelState,
  qualityModel,
} from "../../seo-suggestions/view-model";

// =====================================================================
// WAVE C — Admin Automation (22 cases)
// =====================================================================

test("C1. queue rendering — view-model produces normalized runs", () => {
  const runs: RawRun[] = [
    { runId: "r1", stage: "fact_check", status: "running" },
    { runId: "r2", stage: "waiting_approval", status: "ok" },
  ];
  const n = runs.map(normalizeRun);
  assert.equal(n.length, 2);
  assert.equal(n[0]?.runId, "r1");
});

test("C2. ready state — viewState returns ready when there are runs", () => {
  const state = viewState([{ runId: "r1" }], {});
  assert.equal(state.kind, "ready");
  assert.equal(state.count, 1);
});

test("C3. empty state — viewState returns empty when no runs", () => {
  const state = viewState([], {});
  assert.equal(state.kind, "empty");
});

test("C4. loading state — viewState returns loading when loading=true", () => {
  const state = viewState([], { loading: true });
  assert.equal(state.kind, "loading");
});

test("C5. error state — viewState returns error when error message present", () => {
  const state = viewState([], { error: "boom" });
  assert.equal(state.kind, "error");
  assert.equal(state.message, "boom");
});

test("C6. database_not_configured -> degraded state", () => {
  const state = viewState([], { system: { database: "database_not_configured" } });
  assert.equal(state.kind, "degraded");
  assert.equal(state.code, "database_not_configured");
});

test("C7. wordpress_unreachable -> degraded state", () => {
  const state = viewState([], { system: { wordpress: "wordpress_unreachable" } });
  assert.equal(state.kind, "degraded");
  assert.equal(state.code, "wordpress_unreachable");
});

test("C8. waiting approval state preserved", () => {
  const runs: RawRun[] = [
    { runId: "r1", stage: "waiting_approval", approvalStatus: "pending" },
  ];
  const filtered = filterRuns(runs, { approvalStatus: "pending" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.stage, "waiting_approval");
});

test("C9. failed run preserved with lastError", () => {
  const runs: RawRun[] = [
    {
      runId: "r1",
      stage: "failed",
      status: "failed",
      lastError: "network",
    },
  ];
  const filtered = filterRuns(runs, { status: "failed" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.lastError, "network");
});

test("C10. rights pending preserved", () => {
  const runs: RawRun[] = [
    { runId: "r1", stage: "rights_check", rightsStatus: "pending" },
  ];
  const filtered = filterRuns(runs, { rightsStatus: "pending" });
  assert.equal(filtered.length, 1);
});

test("C11. fact pending preserved", () => {
  const runs: RawRun[] = [
    { runId: "r1", stage: "fact_check", factStatus: "pending" },
  ];
  const filtered = filterRuns(runs, { factStatus: "pending" });
  assert.equal(filtered.length, 1);
});

test("C12. SEO warning preserved", () => {
  const runs: RawRun[] = [
    { runId: "r1", stage: "seo_check", seoStatus: "warn" },
  ];
  const filtered = filterRuns(runs, { seoStatus: "warn" });
  assert.equal(filtered.length, 1);
});

test("C13. full stage timeline produced", () => {
  const timeline = stageTimeline({
    runId: "r1",
    stage: "rights_check",
    timeline: [
      { stage: "ingested", at: "2026-09-01T00:00:00Z", status: "done" },
      { stage: "editorial_created", at: "2026-09-01T00:01:00Z", status: "done" },
      { stage: "rights_check", at: "2026-09-01T00:02:00Z", status: "current" },
    ],
  });
  assert.equal(timeline.length, STAGES.length);
  const rights = timeline.find((t) => t.stage === "rights_check");
  assert.equal(rights?.status, "current");
  const ingested = timeline.find((t) => t.stage === "ingested");
  assert.equal(ingested?.status, "done");
});

test("C14. retry eligibility visibility — NOT_ELIGIBLE", () => {
  const r = retryUiContract({ runId: "r1", retryEligible: false });
  assert.equal(r.visible, true);
  assert.equal(r.enabled, false);
  assert.match(r.label, /Retry unavailable/);
});

test("C15. retry eligibility visibility — ELIGIBLE_TRANSIENT", () => {
  const r = retryUiContract({
    runId: "r1",
    retryEligible: true,
    failureType: "transient",
  });
  assert.equal(r.enabled, false);
  assert.match(r.label, /Retry eligible \(read-only\)/);
});

test("C16. mutationCapabilities all false", () => {
  const caps = adminMutationCapabilities();
  assert.equal(caps.canRetry, false);
  assert.equal(caps.canApprove, false);
  assert.equal(caps.canReject, false);
  assert.equal(caps.canPublish, false);
  assert.equal(caps.canMutateRun, false);
});

test("C17. retryUiContract.enabled always false (even when eligible)", () => {
  const r1 = retryUiContract({ runId: "r1", retryEligible: true, failureType: "transient" });
  const r2 = retryUiContract({ runId: "r2", retryEligible: true });
  const r3 = retryUiContract({ runId: "r3", retryEligible: false });
  assert.equal(r1.enabled, false);
  assert.equal(r2.enabled, false);
  assert.equal(r3.enabled, false);
});

test("C18. filtering by stage + search", () => {
  const runs: RawRun[] = [
    { runId: "r1", stage: "fact_check", title: "Match report" },
    { runId: "r2", stage: "rights_check", title: "Transfer news" },
  ];
  const f1 = filterRuns(runs, { stage: "fact_check" });
  assert.equal(f1.length, 1);
  assert.equal(f1[0]?.runId, "r1");
  const f2 = filterRuns(runs, { search: "transfer" });
  assert.equal(f2.length, 1);
  assert.equal(f2[0]?.runId, "r2");
});

test("C19. search across runId / editorialId / title / lastError / wpPostId", () => {
  const runs: RawRun[] = [
    { runId: "abc", editorialId: "e1", title: "T1" },
    { runId: "def", editorialId: "e2", title: "T2", lastError: "needle" },
    { runId: "ghi", editorialId: "e3", title: "T3", wpPostId: 999 },
  ];
  assert.equal(filterRuns(runs, { search: "abc" }).length, 1);
  assert.equal(filterRuns(runs, { search: "needle" }).length, 1);
  assert.equal(filterRuns(runs, { search: "999" }).length, 1);
  assert.equal(filterRuns(runs, { search: "missing" }).length, 0);
});

test("C20. deterministic view-model — identical input -> identical output", () => {
  const runs: RawRun[] = [
    { runId: "r1", stage: "fact_check", status: "running", timeline: [] },
  ];
  const a = runs.map(normalizeRun);
  const b = runs.map(normalizeRun);
  assert.deepEqual(a, b);
});

test("C21. no network mutation in view-model source", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = fileURLToPath(import.meta.url);
  const src = await fs.readFile(
    path.resolve(path.dirname(here), "..", "..", "automation", "view-model.ts"),
    "utf8",
  );
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    /\bfetch\s*\(|XMLHttpRequest|axios\s*\(/i.test(codeOnly),
    false,
    "view-model must not contain network refs",
  );
});

test("C22. no auth reimplementation in view-model", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = fileURLToPath(import.meta.url);
  const src = await fs.readFile(
    path.resolve(path.dirname(here), "..", "..", "automation", "view-model.ts"),
    "utf8",
  );
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    /requireAdmin|requireAdminOrEditor|verifySessionToken/.test(codeOnly),
    false,
    "view-model must NOT reimplement admin guard",
  );
});

// =====================================================================
// WAVE D — SEO Admin Suggestions (21 cases)
// =====================================================================

test("D1. quality clean — no blocking issues, score=100", () => {
  const q = qualityModel({ score: 100, blockingIssues: [], warnings: [], opportunities: [] });
  assert.equal(q.score, 100);
  assert.equal(q.publishBlocking, false);
});

test("D2. blocking structural issue display — publishBlocking=true", () => {
  const q = qualityModel({ score: 30, blockingIssues: ["missing-canonical"], warnings: [], opportunities: [] });
  assert.equal(q.publishBlocking, true);
  assert.deepEqual(q.blockingIssues, ["missing-canonical"]);
});

test("D3. advisory warning display", () => {
  const q = qualityModel({ score: 70, blockingIssues: [], warnings: ["low-quality"], opportunities: [] });
  assert.equal(q.warnings.length, 1);
  assert.equal(q.warnings[0], "low-quality");
  assert.equal(q.publishBlocking, false);
});

test("D4. opportunity list", () => {
  const q = qualityModel({ score: 80, blockingIssues: [], warnings: [], opportunities: ["add-link"] });
  assert.equal(q.opportunities.length, 1);
  assert.equal(q.opportunities[0], "add-link");
});

test("D5. intent display — known intent", () => {
  const i = intentModel({ intent: "TEAM_NEWS", confidence: 0.92, matchedRules: ["team-news"], landingPageType: "team_hub" });
  assert.equal(i.intent, "TEAM_NEWS");
  assert.equal(i.confidence, 0.92);
  assert.equal(i.lowConfidence, false);
});

test("D6. low-confidence intent — lowConfidence=true", () => {
  const i = intentModel({ intent: "OTHER", confidence: 0.3 });
  assert.equal(i.lowConfidence, true);
});

test("D7. internal link suggestion", () => {
  const links = internalLinksModel([
    { anchor: "Manchester United", target: "/teams/manchester-united", reason: "team-news", confidence: 0.8 },
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0]?.anchor, "Manchester United");
  assert.equal(links[0]?.selected, false);
});

test("D8. GSC low CTR opportunity (HIGH_IMPRESSIONS_LOW_CTR) with rankingGuarantee=false", () => {
  const xs = gscModel([{ type: "HIGH_IMPRESSIONS_LOW_CTR", priority: 90, confidence: 0.7 }]);
  assert.equal(xs[0]?.type, "HIGH_IMPRESSIONS_LOW_CTR");
  assert.equal(xs[0]?.rankingGuarantee, false);
});

test("D9. position 8-20 opportunity preserved", () => {
  const xs = gscModel([{ type: "POSITION_8_TO_20", priority: 80, confidence: 0.65, position: 12 }]);
  assert.equal(xs[0]?.type, "POSITION_8_TO_20");
  assert.equal(xs[0]?.rankingGuarantee, false);
});

test("D10. declining page opportunity preserved", () => {
  const xs = gscModel([{ type: "DECLINING_PAGE", priority: 70, confidence: 0.6 }]);
  assert.equal(xs[0]?.type, "DECLINING_PAGE");
});

test("D11. rising query opportunity preserved", () => {
  const xs = gscModel([{ type: "RISING_QUERY", priority: 60, confidence: 0.55 }]);
  assert.equal(xs[0]?.type, "RISING_QUERY");
});

test("D12. cannibalization opportunity preserved", () => {
  const xs = gscModel([{ type: "CANNIBALIZATION", priority: 50, confidence: 0.5 }]);
  assert.equal(xs[0]?.type, "CANNIBALIZATION");
});

test("D13. low index coverage opportunity preserved", () => {
  const xs = gscModel([{ type: "LOW_INDEX_COVERAGE", priority: 40, confidence: 0.45 }]);
  assert.equal(xs[0]?.type, "LOW_INDEX_COVERAGE");
});

test("D14. title rewrite opportunity preserved", () => {
  const xs = gscModel([{ type: "TITLE_REWRITE_OPPORTUNITY", priority: 30, confidence: 0.4 }]);
  assert.equal(xs[0]?.type, "TITLE_REWRITE_OPPORTUNITY");
});

test("D15. internal link opportunity preserved", () => {
  const xs = gscModel([{ type: "INTERNAL_LINK_OPPORTUNITY", priority: 20, confidence: 0.35 }]);
  assert.equal(xs[0]?.type, "INTERNAL_LINK_OPPORTUNITY");
});

test("D16. unresolved player -> deferred_unresolved", () => {
  const overview = buildSeoOverview({
    entities: { players: [{ id: "p1", name: "Anon" }] },
  });
  const p = overview.entities.players[0];
  assert.equal((p as { status?: string })?.status, "deferred_unresolved");
  assert.equal(identityStatusFor(p), "deferred_unresolved");
});

test("D17. unresolved match -> deferred_unresolved", () => {
  const overview = buildSeoOverview({
    entities: { matches: [{ id: "m1", name: "Unknown vs Unknown" }] },
  });
  const m = overview.entities.matches[0];
  assert.equal((m as { status?: string })?.status, "deferred_unresolved");
  assert.equal(identityStatusFor(m), "deferred_unresolved");
});

test("D18. resolved entity stays resolved", () => {
  const overview = buildSeoOverview({
    entities: { players: [{ id: "p1", name: "Ronaldo", canonicalId: "player:ronaldo" }] },
  });
  const p = overview.entities.players[0];
  assert.equal((p as { status?: string }).status, undefined);
  assert.equal(identityStatusFor(p), "resolved");
});

test("D19. rankingGuarantee=false on every GSC opportunity", () => {
  const xs = gscModel([
    { type: "HIGH_IMPRESSIONS_LOW_CTR", priority: 100 },
    { type: "POSITION_8_TO_20", priority: 90 },
    { type: "DECLINING_PAGE", priority: 80 },
    { type: "RISING_QUERY", priority: 70 },
    { type: "CANNIBALIZATION", priority: 60 },
    { type: "LOW_INDEX_COVERAGE", priority: 50 },
    { type: "TITLE_REWRITE_OPPORTUNITY", priority: 40 },
    { type: "INTERNAL_LINK_OPPORTUNITY", priority: 30 },
  ]);
  for (const x of xs) {
    assert.equal(x.rankingGuarantee, false);
  }
  assert.equal(xs.length, GSC_OPPORTUNITY_TYPES.length);
});

test("D20. mutationCapabilities all false", () => {
  const caps = seoMutationCapabilities();
  assert.equal(caps.canAutoEdit, false);
  assert.equal(caps.canAutoInsertLink, false);
  assert.equal(caps.canRewriteTitle, false);
  assert.equal(caps.canPublish, false);
  assert.equal(caps.canModifyPublishGate, false);
});

test("D21. deterministic model — identical input -> identical output", () => {
  const input = {
    quality: { score: 80, blockingIssues: [], warnings: ["w"], opportunities: [] },
    intent: { intent: "TEAM_NEWS", confidence: 0.9 },
    internalLinks: [{ anchor: "a", target: "t", reason: "r", confidence: 0.8 }],
    gsc: [{ type: "HIGH_IMPRESSIONS_LOW_CTR", priority: 50 }],
    entities: { teams: [{ id: "t1", canonicalId: "team:t1" }] },
  };
  const a = buildSeoOverview(input);
  const b = buildSeoOverview(input);
  assert.deepEqual(a, b);
});

test("D22. panel state — empty when no data", () => {
  const s = panelState(null);
  assert.equal(s.kind, "empty");
});

test("D23. panel state — loading", () => {
  const s = panelState(null, { loading: true });
  assert.equal(s.kind, "loading");
});

test("D24. panel state — error", () => {
  const s = panelState(null, { error: "boom" });
  assert.equal(s.kind, "error");
  assert.equal(s.message, "boom");
});

test("D25. no SEO logic reimplementation — no canonical/quality/intent rules in source", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = fileURLToPath(import.meta.url);
  const src = await fs.readFile(
    path.resolve(path.dirname(here), "..", "..", "seo-suggestions", "view-model.ts"),
    "utf8",
  );
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  // SEO V3 authoritative — no re-implementation.
  assert.equal(
    /FOOTBALL_INTENT_RULES|REAL_INTENT_RULES/.test(codeOnly),
    false,
    "view-model must NOT redefine football intent rules",
  );
  assert.equal(
    /publishGate|publicationDecision/.test(codeOnly),
    false,
    "view-model must NOT touch publish gate",
  );
  assert.equal(
    /wave[Ee]\b/.test(codeOnly),
    false,
    "view-model must NOT reference SEO Wave E",
  );
});