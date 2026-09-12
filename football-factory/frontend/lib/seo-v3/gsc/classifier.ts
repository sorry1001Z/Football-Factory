// Football Factory — SEO V3 GSC Opportunity Classifier (Wave D).
//
// Classifies SearchMetric rows into one of 8 advisory opportunity
// types. Every threshold is configurable. The classifier never
// mutates content; it returns advisory output for editorial review.

import type { SearchMetric } from "./types";

export type OpportunityType =
  | "HIGH_IMPRESSIONS_LOW_CTR"
  | "POSITION_8_TO_20"
  | "DECLINING_PAGE"
  | "RISING_QUERY"
  | "CANNIBALIZATION"
  | "LOW_INDEX_COVERAGE"
  | "TITLE_REWRITE_OPPORTUNITY"
  | "INTERNAL_LINK_OPPORTUNITY";

export interface OpportunityThresholds {
  /** Minimum impressions required for HIGH_IMPRESSIONS_LOW_CTR. */
  highImpressionsMin?: number;
  /** CTR threshold below which a high-impression row is flagged. */
  lowCtr?: number;
  /** Position range [min, max] for POSITION_8_TO_20 (default [8, 20]). */
  positionBand?: readonly [number, number];
  /** Minimum impressions required for POSITION_8_TO_20. */
  positionBandMinImpressions?: number;
  /** Ratio: impressions must drop to (previous * declineRatio) to flag. */
  declineRatio?: number;
  /** Ratio: impressions must rise to (previous * riseRatio) to flag. */
  riseRatio?: number;
  /** Minimum prior impressions required for trend classification. */
  trendPriorMin?: number;
  /** Minimum impressions per page required for CANNIBALIZATION. */
  cannibalizationMinImpressions?: number;
  /** Minimum number of competing pages with overlapping impressions. */
  cannibalizationMinPages?: number;
  /** Internal link opportunity minimum impressions. */
  internalLinkMinImpressions?: number;
  /** Internal link opportunity position ceiling. */
  internalLinkPositionCeiling?: number;
}

export const DEFAULTS: Required<OpportunityThresholds> = {
  highImpressionsMin: 1000,
  lowCtr: 0.02,
  positionBand: [8, 20] as const,
  positionBandMinImpressions: 200,
  declineRatio: 0.7,
  riseRatio: 1.3,
  trendPriorMin: 100,
  cannibalizationMinImpressions: 100,
  cannibalizationMinPages: 2,
  internalLinkMinImpressions: 200,
  internalLinkPositionCeiling: 20,
};

export interface Opportunity {
  type: OpportunityType;
  /** Higher = more important. */
  priority: number;
  /** 0..1 — confidence the signal is real, not noise. */
  confidence: number;
  /** Human-readable explanation. */
  reason: string;
  /** Structured evidence (URL, query, numbers). */
  evidence: Record<string, unknown>;
  /** Suggested action (advisory only). */
  recommendedAction: string;
}

export interface ClassifierInput {
  metrics: SearchMetric[];
  thresholds?: OpportunityThresholds;
}

export interface ClassifierResult {
  opportunities: Opportunity[];
  /** policyVersion identifier for downstream consumers. */
  policyVersion: string;
}

const POLICY_VERSION = "gsc-classifier/v1";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function isFinite(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

function priorityForType(t: OpportunityType): number {
  switch (t) {
    case "HIGH_IMPRESSIONS_LOW_CTR":
      return 80;
    case "POSITION_8_TO_20":
      return 70;
    case "DECLINING_PAGE":
      return 75;
    case "RISING_QUERY":
      return 65;
    case "CANNIBALIZATION":
      return 85;
    case "LOW_INDEX_COVERAGE":
      return 60;
    case "TITLE_REWRITE_OPPORTUNITY":
      return 50;
    case "INTERNAL_LINK_OPPORTUNITY":
      return 55;
  }
}

// -----------------------------------------------------------------------------
// Per-row classifiers
// -----------------------------------------------------------------------------

function classifyRow(row: SearchMetric, t: Required<OpportunityThresholds>): Opportunity[] {
  const out: Opportunity[] = [];
  if (row.impressions >= t.highImpressionsMin && row.ctr <= t.lowCtr) {
    out.push({
      type: "HIGH_IMPRESSIONS_LOW_CTR",
      priority: priorityForType("HIGH_IMPRESSIONS_LOW_CTR"),
      confidence: clamp01(0.5 + (row.impressions - t.highImpressionsMin) / t.highImpressionsMin * 0.5),
      reason: `${row.impressions} impressions but CTR is ${(row.ctr * 100).toFixed(2)}% (≤ ${(t.lowCtr * 100).toFixed(2)}%).`,
      evidence: { query: row.query, page: row.page, impressions: row.impressions, ctr: row.ctr },
      recommendedAction: "Consider rewriting the title + meta description to better match search intent.",
    });
  }
  if (
    row.impressions >= t.positionBandMinImpressions &&
    row.position >= t.positionBand[0] &&
    row.position <= t.positionBand[1]
  ) {
    out.push({
      type: "POSITION_8_TO_20",
      priority: priorityForType("POSITION_8_TO_20"),
      confidence: clamp01(0.5 + (t.positionBand[1] - row.position) / (t.positionBand[1] - t.positionBand[0]) * 0.5),
      reason: `Page ranks at position ${row.position} for "${row.query}" — within the configurable optimization band.`,
      evidence: { query: row.query, page: row.page, position: row.position, impressions: row.impressions },
      recommendedAction: "Optimize content + internal links to improve ranking.",
    });
  }
  const ilc = row.internalLinkCount;
  if (typeof ilc === "number" && Number.isFinite(ilc) && ilc <= 2 && row.position <= t.internalLinkPositionCeiling && row.impressions >= t.internalLinkMinImpressions) {
    out.push({
      type: "INTERNAL_LINK_OPPORTUNITY",
      priority: priorityForType("INTERNAL_LINK_OPPORTUNITY"),
      confidence: clamp01(0.6),
      reason: `Page has only ${row.internalLinkCount} internal links despite ${row.impressions} impressions at position ${row.position}.`,
      evidence: { page: row.page, internalLinkCount: row.internalLinkCount, position: row.position, impressions: row.impressions },
      recommendedAction: "Add contextual internal links from authoritative pages on the same topic.",
    });
  }
  return out;
}

function classifyTrend(
  row: SearchMetric,
  t: Required<OpportunityThresholds>,
): Opportunity[] {
  const out: Opportunity[] = [];
  if (
    row.previousImpressions !== undefined &&
    row.previousImpressions >= t.trendPriorMin &&
    row.previousImpressions > 0
  ) {
    const ratio = safeDiv(row.impressions, row.previousImpressions);
    if (ratio >= t.riseRatio) {
      out.push({
        type: "RISING_QUERY",
        priority: priorityForType("RISING_QUERY"),
        confidence: clamp01((ratio - 1) / (t.riseRatio - 1) * 0.5 + 0.5),
        reason: `Impressions for "${row.query}" rose from ${row.previousImpressions} to ${row.impressions} (×${ratio.toFixed(2)}).`,
        evidence: { query: row.query, page: row.page, previousImpressions: row.previousImpressions, impressions: row.impressions, ratio },
        recommendedAction: "Investigate the cause and double-down on the topic.",
      });
    } else if (ratio <= t.declineRatio) {
      out.push({
        type: "DECLINING_PAGE",
        priority: priorityForType("DECLINING_PAGE"),
        confidence: clamp01((1 - ratio) / (1 - t.declineRatio) * 0.5 + 0.5),
        reason: `Impressions on ${row.page} fell from ${row.previousImpressions} to ${row.impressions} (×${ratio.toFixed(2)}).`,
        evidence: { page: row.page, previousImpressions: row.previousImpressions, impressions: row.impressions, ratio },
        recommendedAction: "Audit content freshness and internal link graph.",
      });
    }
  }
  return out;
}

function classifyIndexCoverage(row: SearchMetric): Opportunity[] {
  if (!row.indexState || row.indexState === "UNKNOWN") return [];
  if (row.indexState === "INDEXED") return [];
  return [
    {
      type: "LOW_INDEX_COVERAGE",
      priority: priorityForType("LOW_INDEX_COVERAGE"),
      confidence: 0.9,
      reason: `Page ${row.page} indexState is ${row.indexState}.`,
      evidence: { page: row.page, indexState: row.indexState },
      recommendedAction: "Inspect index coverage report and fix any blocking issues.",
    },
  ];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// -----------------------------------------------------------------------------
// Cannibalization (multi-row)
// -----------------------------------------------------------------------------

function classifyCannibalization(
  rows: SearchMetric[],
  t: Required<OpportunityThresholds>,
): Opportunity[] {
  // Group by query, within a single site. Each query → list of pages.
  const byQuery = new Map<string, SearchMetric[]>();
  for (const r of rows) {
    const list = byQuery.get(r.query) ?? [];
    list.push(r);
    byQuery.set(r.query, list);
  }
  const out: Opportunity[] = [];
  for (const [query, list] of byQuery) {
    if (list.length < t.cannibalizationMinPages) continue;
    const significant = list.filter((r) => r.impressions >= t.cannibalizationMinImpressions);
    if (significant.length < t.cannibalizationMinPages) continue;
    // "Competing search visibility" = at least 2 significant pages
    // AND at least 2 of those have position within a band of 5 from
    // each other (configurable overlap heuristic).
    const positions = significant.map((r) => r.position).sort((a, b) => a - b);
    let overlap = false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] - positions[i - 1] <= 5) {
        overlap = true;
        break;
      }
    }
    if (!overlap) continue;
    out.push({
      type: "CANNIBALIZATION",
      priority: priorityForType("CANNIBALIZATION"),
      confidence: clamp01(0.5 + Math.min(significant.length, 5) / 10),
      reason: `Query "${query}" competes on ${significant.length} pages with overlapping ranking positions.`,
      evidence: {
        query,
        pages: significant.map((r) => ({ page: r.page, impressions: r.impressions, position: r.position })),
      },
      recommendedAction: "Consolidate or differentiate the competing pages.",
    });
  }
  return out;
}

// -----------------------------------------------------------------------------
// Public entry
// -----------------------------------------------------------------------------

export function classifyOpportunities(input: ClassifierInput): ClassifierResult {
  const t: Required<OpportunityThresholds> = { ...DEFAULTS, ...(input.thresholds ?? {}) };
  const opportunities: Opportunity[] = [];
  // Per-row.
  for (const r of input.metrics) {
    if (!r || typeof r !== "object") continue;
    opportunities.push(...classifyRow(r, t));
    opportunities.push(...classifyTrend(r, t));
    opportunities.push(...classifyIndexCoverage(r));
  }
  // Multi-row.
  opportunities.push(...classifyCannibalization(input.metrics, t));
  // Sort deterministically.
  opportunities.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.type.localeCompare(b.type);
  });
  return { opportunities, policyVersion: POLICY_VERSION };
}

// -----------------------------------------------------------------------------
// Title rewrite opportunity (advisory-only).
// Synthesised by combining HIGH_IMPRESSIONS_LOW_CTR + page
// clustering: when 2+ high-impression / low-CTR rows share a page,
// a TITLE_REWRITE_OPPORTUNITY is suggested. Never rewrites the
// title automatically; advisory only.
// -----------------------------------------------------------------------------

export function synthesizeTitleRewriteOpportunities(
  result: ClassifierResult,
): Opportunity[] {
  const lowCtr = result.opportunities.filter((o) => o.type === "HIGH_IMPRESSIONS_LOW_CTR");
  const byPage = new Map<string, Opportunity[]>();
  for (const o of lowCtr) {
    const page = (o.evidence as { page?: string }).page;
    if (typeof page !== "string") continue;
    const list = byPage.get(page) ?? [];
    list.push(o);
    byPage.set(page, list);
  }
  const out: Opportunity[] = [];
  for (const [page, list] of byPage) {
    if (list.length < 2) continue;
    out.push({
      type: "TITLE_REWRITE_OPPORTUNITY",
      priority: priorityForType("TITLE_REWRITE_OPPORTUNITY"),
      confidence: clamp01(0.5 + Math.min(list.length, 5) * 0.1),
      reason: `${list.length} high-impression / low-CTR queries point to ${page}.`,
      evidence: { page, queries: list.map((o) => (o.evidence as { query?: string }).query) },
      recommendedAction: "Consider rewriting the title + meta to better satisfy the most frequent queries.",
    });
  }
  return out;
}
