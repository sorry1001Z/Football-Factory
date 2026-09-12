// Football Factory — SEO V3 GSC Aggregation helpers (Wave D).
//
// Read-only views over `SearchMetric` rows + `Opportunity` lists.
// Deterministic ordering: priority DESC, confidence DESC,
// impressions DESC, page/query lexical ASC.

import type { Opportunity } from "./classifier";
import type { SearchMetric } from "./types";

export function sortOpportunities(opps: readonly Opportunity[]): Opportunity[] {
  return opps.slice().sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.type.localeCompare(b.type);
  });
}

export function getTopOpportunities(
  opps: readonly Opportunity[],
  limit?: number,
): Opportunity[] {
  const sorted = sortOpportunities(opps);
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

/** Group opportunities by page. */
export function getPageOpportunities(opps: readonly Opportunity[]): Map<string, Opportunity[]> {
  const out = new Map<string, Opportunity[]>();
  for (const o of opps) {
    const page = (o.evidence as { page?: string }).page;
    if (typeof page !== "string") continue;
    const list = out.get(page) ?? [];
    list.push(o);
    out.set(page, list);
  }
  return out;
}

/** Group opportunities by query. */
export function getQueryOpportunities(opps: readonly Opportunity[]): Map<string, Opportunity[]> {
  const out = new Map<string, Opportunity[]>();
  for (const o of opps) {
    const query = (o.evidence as { query?: string }).query;
    if (typeof query !== "string") continue;
    const list = out.get(query) ?? [];
    list.push(o);
    out.set(query, list);
  }
  return out;
}

/** Group CANNIBALIZATION opportunities by the query they collide on. */
export function getCannibalizationGroups(opps: readonly Opportunity[]): Map<string, Opportunity[]> {
  const out = new Map<string, Opportunity[]>();
  for (const o of opps) {
    if (o.type !== "CANNIBALIZATION") continue;
    const query = (o.evidence as { query?: string }).query;
    if (typeof query !== "string") continue;
    const list = out.get(query) ?? [];
    list.push(o);
    out.set(query, list);
  }
  return out;
}

/** Rising-query aggregation: group RISING_QUERY opportunities by query, sorted by ratio. */
export function getRisingQueries(opps: readonly Opportunity[]): Array<{
  query: string;
  opportunities: Opportunity[];
}> {
  const groups = new Map<string, Opportunity[]>();
  for (const o of opps) {
    if (o.type !== "RISING_QUERY") continue;
    const query = (o.evidence as { query?: string }).query;
    if (typeof query !== "string") continue;
    const list = groups.get(query) ?? [];
    list.push(o);
    groups.set(query, list);
  }
  const out: Array<{ query: string; opportunities: Opportunity[] }> = [];
  for (const [query, list] of groups) {
    out.push({ query, opportunities: list });
  }
  out.sort((a, b) => {
    const ra = Math.max(...a.opportunities.map((o) => Number((o.evidence as { ratio?: number }).ratio ?? 0)));
    const rb = Math.max(...b.opportunities.map((o) => Number((o.evidence as { ratio?: number }).ratio ?? 0)));
    if (rb !== ra) return rb - ra;
    return a.query.localeCompare(b.query);
  });
  return out;
}

/** Declining-page aggregation: group DECLINING_PAGE opportunities by page, sorted by ratio ASC. */
export function getDecliningPages(opps: readonly Opportunity[]): Array<{
  page: string;
  opportunities: Opportunity[];
}> {
  const groups = new Map<string, Opportunity[]>();
  for (const o of opps) {
    if (o.type !== "DECLINING_PAGE") continue;
    const page = (o.evidence as { page?: string }).page;
    if (typeof page !== "string") continue;
    const list = groups.get(page) ?? [];
    list.push(o);
    groups.set(page, list);
  }
  const out: Array<{ page: string; opportunities: Opportunity[] }> = [];
  for (const [page, list] of groups) {
    out.push({ page, opportunities: list });
  }
  out.sort((a, b) => {
    const ra = Math.min(...a.opportunities.map((o) => Number((o.evidence as { ratio?: number }).ratio ?? 1)));
    const rb = Math.min(...b.opportunities.map((o) => Number((o.evidence as { ratio?: number }).ratio ?? 1)));
    if (rb !== ra) return ra - rb;
    return a.page.localeCompare(b.page);
  });
  return out;
}

/** Aggregate impressions by page across the input metric rows. */
export function aggregateImpressionsByPage(metrics: readonly SearchMetric[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of metrics) {
    if (!m || typeof m.page !== "string") continue;
    out.set(m.page, (out.get(m.page) ?? 0) + m.impressions);
  }
  return out;
}
