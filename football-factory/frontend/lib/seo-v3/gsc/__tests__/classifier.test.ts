// Football Factory — SEO V3 GSC classifier tests (Wave D).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyOpportunities,
  synthesizeTitleRewriteOpportunities,
  DEFAULTS,
} from "../classifier";
import type { SearchMetric } from "../types";

const baseRow: SearchMetric = {
  site: "example.com",
  query: "q1",
  page: "/x",
  clicks: 0,
  impressions: 0,
  position: 1,
  ctr: 0,
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
};

test("classifier: empty data → no opportunities", () => {
  const r = classifyOpportunities({ metrics: [] });
  assert.equal(r.opportunities.length, 0);
});

test("classifier: HIGH_IMPRESSIONS_LOW_CTR fires above threshold", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, query: "hi", impressions: 5000, ctr: 0.005, position: 10 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "HIGH_IMPRESSIONS_LOW_CTR");
  assert.ok(hit);
});

test("classifier: HIGH_IMPRESSIONS_LOW_CTR does NOT fire below threshold", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, query: "lo", impressions: 999, ctr: 0.005, position: 10 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "HIGH_IMPRESSIONS_LOW_CTR");
  assert.equal(hit, undefined);
});

test("classifier: POSITION_8_TO_20 fires inside the band", () => {
  const r = classifyOpportunities({
    metrics: [{ ...baseRow, impressions: 500, position: 12 }],
  });
  const hit = r.opportunities.find((o) => o.type === "POSITION_8_TO_20");
  assert.ok(hit);
});

test("classifier: POSITION_8_TO_20 does NOT fire outside the band", () => {
  const r = classifyOpportunities({
    metrics: [{ ...baseRow, impressions: 500, position: 4 }],
  });
  const hit = r.opportunities.find((o) => o.type === "POSITION_8_TO_20");
  assert.equal(hit, undefined);
});

test("classifier: RISING_QUERY detected when ratio exceeds threshold", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, query: "r", impressions: 1300, previousImpressions: 1000 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "RISING_QUERY");
  assert.ok(hit);
});

test("classifier: DECLINING_PAGE detected when ratio drops below threshold", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, page: "/y", impressions: 600, previousImpressions: 1000 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "DECLINING_PAGE");
  assert.ok(hit);
});

test("classifier: trend missing previous period → no trend classification", () => {
  const r = classifyOpportunities({
    metrics: [{ ...baseRow, impressions: 1300 }],
  });
  assert.equal(
    r.opportunities.find((o) => o.type === "RISING_QUERY"),
    undefined,
  );
  assert.equal(
    r.opportunities.find((o) => o.type === "DECLINING_PAGE"),
    undefined,
  );
});

test("classifier: trend prior too small → no trend classification", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, impressions: 1300, previousImpressions: 50 },
    ],
  });
  assert.equal(
    r.opportunities.find((o) => o.type === "RISING_QUERY"),
    undefined,
  );
});

test("classifier: divide-by-zero safe (previousImpressions === 0)", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, impressions: 1300, previousImpressions: 0 },
    ],
  });
  // Should not throw; should not classify.
  assert.equal(
    r.opportunities.find((o) => o.type === "RISING_QUERY"),
    undefined,
  );
});

test("classifier: CANNIBALIZATION flagged only with meaningful evidence", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, query: "k", page: "/a", impressions: 500, position: 10 },
      { ...baseRow, query: "k", page: "/b", impressions: 500, position: 12 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "CANNIBALIZATION");
  assert.ok(hit);
});

test("classifier: CANNIBALIZATION NOT flagged on tiny duplicates", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, query: "k", page: "/a", impressions: 50, position: 10 },
      { ...baseRow, query: "k", page: "/b", impressions: 50, position: 12 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "CANNIBALIZATION");
  assert.equal(hit, undefined);
});

test("classifier: CANNIBALIZATION NOT flagged when ranking positions don't overlap", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, query: "k", page: "/a", impressions: 500, position: 2 },
      { ...baseRow, query: "k", page: "/b", impressions: 500, position: 30 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "CANNIBALIZATION");
  assert.equal(hit, undefined);
});

test("classifier: LOW_INDEX_COVERAGE consumed from indexState", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, page: "/z", indexState: "CRAWLED_NOT_INDEXED" },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "LOW_INDEX_COVERAGE");
  assert.ok(hit);
});

test("classifier: LOW_INDEX_COVERAGE not fabricated when indexState missing", () => {
  const r = classifyOpportunities({
    metrics: [{ ...baseRow, page: "/z" }],
  });
  const hit = r.opportunities.find((o) => o.type === "LOW_INDEX_COVERAGE");
  assert.equal(hit, undefined);
});

test("classifier: INTERNAL_LINK_OPPORTUNITY fires when links are scarce", () => {
  const r = classifyOpportunities({
    metrics: [
      { ...baseRow, page: "/p", impressions: 500, position: 12, internalLinkCount: 1 },
    ],
  });
  const hit = r.opportunities.find((o) => o.type === "INTERNAL_LINK_OPPORTUNITY");
  assert.ok(hit);
});

test("classifier: threshold overrides work", () => {
  const r = classifyOpportunities({
    metrics: [{ ...baseRow, impressions: 1500, ctr: 0.01, position: 10 }],
    thresholds: { highImpressionsMin: 2000 },
  });
  const hit = r.opportunities.find((o) => o.type === "HIGH_IMPRESSIONS_LOW_CTR");
  assert.equal(hit, undefined);
});

test("classifier: defaults exposed", () => {
  assert.equal(typeof DEFAULTS.highImpressionsMin, "number");
  assert.equal(typeof DEFAULTS.lowCtr, "number");
  assert.equal(typeof DEFAULTS.cannibalizationMinPages, "number");
});

test("synthesize: TITLE_REWRITE_OPPORTUNITY when 2+ high-ctr rows share a page", () => {
  const c = classifyOpportunities({
    metrics: [
      { ...baseRow, query: "a", page: "/p", impressions: 5000, ctr: 0.005, position: 10 },
      { ...baseRow, query: "b", page: "/p", impressions: 5000, ctr: 0.005, position: 10 },
    ],
  });
  const titles = synthesizeTitleRewriteOpportunities(c);
  const hit = titles.find((o) => o.type === "TITLE_REWRITE_OPPORTUNITY");
  assert.ok(hit);
  assert.equal(hit!.recommendedAction.includes("rewrite") || hit!.recommendedAction.includes("rewriting"), true);
});
