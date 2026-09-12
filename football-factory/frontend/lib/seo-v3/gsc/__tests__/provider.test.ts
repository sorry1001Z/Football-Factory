// Football Factory — SEO V3 GSC provider tests (Wave D).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FixtureSearchMetricsProvider,
  EMPTY_FIXTURE_PROVIDER,
} from "../fixture-provider";
import {
  validateGetMetricsParams,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from "../provider";
import type { SearchMetric } from "../types";

const SAMPLE: SearchMetric[] = [
  {
    site: "example.com",
    query: "manchester united",
    page: "/news/man-utd-comeback",
    clicks: 50,
    impressions: 5000,
    position: 12,
    ctr: 0.01,
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  },
  {
    site: "example.com",
    query: "premier league",
    page: "/competitions/premier-league",
    clicks: 200,
    impressions: 8000,
    position: 4,
    ctr: 0.025,
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  },
];

const p = new FixtureSearchMetricsProvider(SAMPLE);

test("provider: valid range", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  // Success path — no `ok: false` discriminator.
  assert.ok(!("code" in r));
  if ("metrics" in r) {
    assert.equal(r.metrics.length, 2);
  } else {
    assert.fail("expected metrics");
  }
});

test("provider: invalid date format", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "not-a-date",
    dateTo: "2026-08-31",
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "INVALID_DATE_FORMAT");
});

test("provider: reversed range", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-31",
    dateTo: "2026-08-01",
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "INVALID_DATE_RANGE");
});

test("provider: same date (empty range)", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-01",
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "EMPTY_RANGE");
});

test("provider: pageSize cap", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
    pageSize: MAX_PAGE_SIZE + 1,
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "PAGE_SIZE_TOO_LARGE");
});

test("provider: pageSize negative", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
    pageSize: -1,
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "PAGE_SIZE_NEGATIVE");
});

test("provider: unsupported filter", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
    filters: [{ field: "evil_field" as any, equals: "x" }],
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "UNSUPPORTED_FILTER_FIELD");
});

test("provider: unsupported dimension", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
    dimensions: ["evil_dimension" as any],
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "UNSUPPORTED_DIMENSION");
});

test("provider: deterministic output (same input → same output)", async () => {
  const r1 = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  const r2 = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  assert.deepEqual(r1, r2);
});

test("provider: empty site", async () => {
  const r = await p.getMetrics({
    site: "   ",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  assert.equal((r as { ok?: boolean }).ok, false);
  assert.equal((r as { code?: string }).code, "EMPTY_SITE");
});

test("provider: pageSize defaults to DEFAULT_PAGE_SIZE", async () => {
  assert.equal(DEFAULT_PAGE_SIZE, 1000);
});

test("provider: filter by query returns subset", async () => {
  const r = await p.getMetrics({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
    filters: [{ field: "query", equals: "premier league" }],
  });
  if ("metrics" in r) {
    assert.equal(r.metrics.length, 1);
    assert.equal(r.metrics[0].query, "premier league");
  } else {
    assert.fail("expected metrics");
  }
});

test("validateGetMetricsParams: returns null on valid", () => {
  const err = validateGetMetricsParams({
    site: "example.com",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  assert.equal(err, null);
});

test("validateGetMetricsParams: empty site", () => {
  const err = validateGetMetricsParams({
    site: "",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  assert.ok(err);
  assert.equal(err!.code, "EMPTY_SITE");
});
