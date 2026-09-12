// Football Factory — SEO V3 GSC aggregates tests (Wave D).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getTopOpportunities,
  getPageOpportunities,
  getQueryOpportunities,
  getCannibalizationGroups,
  getRisingQueries,
  getDecliningPages,
  aggregateImpressionsByPage,
  sortOpportunities,
} from "../aggregates";
import { classifyOpportunities } from "../classifier";
import type { Opportunity } from "../classifier";
import type { SearchMetric } from "../types";

function mkOpp(
  type: Opportunity["type"],
  priority: number,
  confidence: number,
  evidence: Record<string, unknown>,
): Opportunity {
  return {
    type,
    priority,
    confidence,
    reason: "test",
    evidence,
    recommendedAction: "test",
  };
}

const M = (over: Partial<SearchMetric>): SearchMetric => ({
  site: "example.com",
  query: "q",
  page: "/p",
  clicks: 0,
  impressions: 100,
  position: 10,
  ctr: 0.01,
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  ...over,
});

test("aggregates: deterministic ordering (priority DESC, confidence DESC, type ASC)", () => {
  const opps = [
    mkOpp("POSITION_8_TO_20", 70, 0.9, {}),
    mkOpp("HIGH_IMPRESSIONS_LOW_CTR", 80, 0.7, {}),
    mkOpp("HIGH_IMPRESSIONS_LOW_CTR", 80, 0.9, {}),
    mkOpp("CANNIBALIZATION", 85, 0.5, {}),
  ];
  const sorted = sortOpportunities(opps);
  assert.deepEqual(
    sorted.map((o) => o.type),
    ["CANNIBALIZATION", "HIGH_IMPRESSIONS_LOW_CTR", "HIGH_IMPRESSIONS_LOW_CTR", "POSITION_8_TO_20"],
  );
});

test("aggregates: getTopOpportunities respects limit", () => {
  const opps = [
    mkOpp("POSITION_8_TO_20", 70, 0.9, {}),
    mkOpp("HIGH_IMPRESSIONS_LOW_CTR", 80, 0.7, {}),
    mkOpp("CANNIBALIZATION", 85, 0.5, {}),
  ];
  const top = getTopOpportunities(opps, 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].type, "CANNIBALIZATION");
});

test("aggregates: getPageOpportunities groups by page", () => {
  const opps = [
    mkOpp("POSITION_8_TO_20", 70, 0.9, { page: "/a" }),
    mkOpp("INTERNAL_LINK_OPPORTUNITY", 55, 0.6, { page: "/a" }),
    mkOpp("POSITION_8_TO_20", 70, 0.9, { page: "/b" }),
  ];
  const groups = getPageOpportunities(opps);
  assert.equal(groups.get("/a")!.length, 2);
  assert.equal(groups.get("/b")!.length, 1);
});

test("aggregates: getQueryOpportunities groups by query", () => {
  const opps = [
    mkOpp("HIGH_IMPRESSIONS_LOW_CTR", 80, 0.9, { query: "k1" }),
    mkOpp("RISING_QUERY", 65, 0.9, { query: "k1" }),
    mkOpp("HIGH_IMPRESSIONS_LOW_CTR", 80, 0.9, { query: "k2" }),
  ];
  const groups = getQueryOpportunities(opps);
  assert.equal(groups.get("k1")!.length, 2);
  assert.equal(groups.get("k2")!.length, 1);
});

test("aggregates: getCannibalizationGroups filters by type", () => {
  const opps = [
    mkOpp("CANNIBALIZATION", 85, 0.9, { query: "k1" }),
    mkOpp("CANNIBALIZATION", 85, 0.7, { query: "k2" }),
    mkOpp("HIGH_IMPRESSIONS_LOW_CTR", 80, 0.9, { query: "k1" }),
  ];
  const groups = getCannibalizationGroups(opps);
  assert.equal(groups.size, 2);
  assert.equal(groups.get("k1")!.length, 1);
});

test("aggregates: getRisingQueries sorted by ratio DESC", () => {
  const opps = [
    mkOpp("RISING_QUERY", 65, 0.9, { query: "low", ratio: 1.4 }),
    mkOpp("RISING_QUERY", 65, 0.9, { query: "high", ratio: 2.5 }),
  ];
  const r = getRisingQueries(opps);
  assert.equal(r[0].query, "high");
  assert.equal(r[1].query, "low");
});

test("aggregates: getDecliningPages sorted by ratio ASC", () => {
  const opps = [
    mkOpp("DECLINING_PAGE", 75, 0.9, { page: "/a", ratio: 0.6 }),
    mkOpp("DECLINING_PAGE", 75, 0.9, { page: "/b", ratio: 0.3 }),
  ];
  const r = getDecliningPages(opps);
  assert.equal(r[0].page, "/b");
  assert.equal(r[1].page, "/a");
});

test("aggregates: aggregateImpressionsByPage sums correctly", () => {
  const metrics = [
    M({ page: "/a", impressions: 100 }),
    M({ page: "/a", impressions: 50 }),
    M({ page: "/b", impressions: 200 }),
  ];
  const map = aggregateImpressionsByPage(metrics);
  assert.equal(map.get("/a"), 150);
  assert.equal(map.get("/b"), 200);
});

test("aggregates: end-to-end with classifier output is deterministic", () => {
  const m1: SearchMetric[] = [
    M({ query: "k", page: "/a", impressions: 600, position: 10 }),
    M({ query: "k", page: "/b", impressions: 600, position: 12 }),
  ];
  const c1 = classifyOpportunities({ metrics: m1 });
  const m2: SearchMetric[] = m1.slice().reverse();
  const c2 = classifyOpportunities({ metrics: m2 });
  assert.deepEqual(
    c1.opportunities.map((o) => o.type),
    c2.opportunities.map((o) => o.type),
  );
});
