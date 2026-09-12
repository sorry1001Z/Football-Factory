// Football Factory — SEO V3 FixtureSearchMetricsProvider (Wave D).
//
// Fixture-only implementation of `SearchMetricsProvider`. No fetch.
// No OAuth. No env credentials. Reads from a typed in-memory table
// passed at construction time. Deterministic output: identical
// input → identical output (sorted by canonical key).

import {
  DEFAULT_PAGE_SIZE,
  validateGetMetricsParams,
  type ProviderResult,
  type SearchMetricsProvider,
} from "./provider";
import type { GetMetricsParams, SearchMetric } from "./types";

/** Whitelisted accessor keys for safe reads. */
const ALLOWED_TOP_KEYS = new Set([
  "site",
  "query",
  "page",
  "clicks",
  "impressions",
  "position",
  "ctr",
  "previousClicks",
  "previousImpressions",
  "previousCtr",
  "previousPosition",
  "dateFrom",
  "dateTo",
  "indexState",
  "pageType",
  "internalLinkCount",
] as const);

function getField(m: SearchMetric, field: string): unknown {
  // Strict whitelisted access. No `(m as any)[field]` escape hatch.
  if (!ALLOWED_TOP_KEYS.has(field as (typeof ALLOWED_TOP_KEYS extends Set<infer T> ? T : never))) {
    return undefined;
  }
  return (m as unknown as Record<string, unknown>)[field];
}

function metricMatches(m: SearchMetric, params: GetMetricsParams): boolean {
  if (m.site !== params.site) return false;
  // Date window: m.dateFrom..m.dateTo overlaps with params.dateFrom..params.dateTo.
  // For fixture simplicity, exact match is sufficient; production-shaped
  // providers can do real window arithmetic.
  if (m.dateFrom !== params.dateFrom) return false;
  if (m.dateTo !== params.dateTo) return false;
  if (params.filters) {
    for (const f of params.filters) {
      const v = getField(m, f.field);
      if (typeof v !== "string" || v !== f.equals) return false;
    }
  }
  return true;
}

function sortByCanonicalKey(metrics: SearchMetric[]): SearchMetric[] {
  return metrics.slice().sort((a, b) => {
    if (a.site !== b.site) return a.site.localeCompare(b.site);
    if (a.query !== b.query) return a.query.localeCompare(b.query);
    if (a.page !== b.page) return a.page.localeCompare(b.page);
    if (a.dateFrom !== b.dateFrom) return a.dateFrom.localeCompare(b.dateFrom);
    return a.dateTo.localeCompare(b.dateTo);
  });
}

export class FixtureSearchMetricsProvider implements SearchMetricsProvider {
  private readonly rows: SearchMetric[];

  constructor(rows: SearchMetric[]) {
    // Defensive copy + canonical sort at construction so the
    // provider never returns a different ordering on repeated
    // reads.
    this.rows = sortByCanonicalKey(rows.slice());
  }

  async getMetrics(params: GetMetricsParams): Promise<ProviderResult> {
    const err = validateGetMetricsParams(params);
    if (err) return err;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const matched: SearchMetric[] = [];
    for (const m of this.rows) {
      if (metricMatches(m, params)) matched.push(m);
    }
    const truncated = matched.length > pageSize;
    const slice = truncated ? matched.slice(0, pageSize) : matched;
    return {
      metrics: slice,
      truncated,
      fetchedAt: "1970-01-01T00:00:00.000Z", // deterministic; override in real provider
    };
  }
}

/** Empty fixture for tests that should always return zero results. */
export const EMPTY_FIXTURE_PROVIDER = new FixtureSearchMetricsProvider([]);
