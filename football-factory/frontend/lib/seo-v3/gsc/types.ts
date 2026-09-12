// Football Factory — SEO V3 Search Metrics types (Wave D).
//
// Generic, domain-neutral types for a SearchMetricsProvider
// contract. No Google SDK leakage. Production-shaped only — the
// GSC source-of-truth API surface can change without breaking
// the consumer.

export type Site = string;

export type IndexState =
  | "INDEXED"
  | "CRAWLED_NOT_INDEXED"
  | "DISCOVERED_NOT_INDEXED"
  | "EXCLUDED"
  | "UNKNOWN";

export type PageType =
  | "HOMEPAGE"
  | "ARTICLE"
  | "TEAM_HUB"
  | "COMPETITION_HUB"
  | "PLAYER_HUB"
  | "MATCH_PAGE"
  | "NEWS_LIST"
  | "OTHER";

/** Whitelisted dimension keys. */
export type MetricDimension = "query" | "page" | "date" | "country" | "device";

/** Whitelisted filter field keys. */
export type MetricFilterField =
  | "query"
  | "page"
  | "country"
  | "device"
  | "pageType"
  | "indexState";

export interface MetricFilter {
  field: MetricFilterField;
  /** Equality match against the dimension value. */
  equals: string;
}

export interface SearchMetric {
  site: Site;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  /** Position (1-indexed). 0 indicates "no data". */
  position: number;
  /** Click-through rate (0..1). */
  ctr: number;
  /** Optional previous-period comparison. */
  previousClicks?: number;
  previousImpressions?: number;
  previousCtr?: number;
  previousPosition?: number;
  dateFrom: string;
  dateTo: string;
  indexState?: IndexState;
  pageType?: PageType;
  internalLinkCount?: number;
}

export interface GetMetricsParams {
  site: Site;
  /** ISO 8601 date (YYYY-MM-DD). */
  dateFrom: string;
  /** ISO 8601 date (YYYY-MM-DD). */
  dateTo: string;
  dimensions?: MetricDimension[];
  filters?: MetricFilter[];
  pageSize?: number;
}

export interface GetMetricsResult {
  metrics: SearchMetric[];
  /** True when the source truncated; consumer should request a narrower range. */
  truncated?: boolean;
  /** Wall-clock ISO timestamp of the response. */
  fetchedAt: string;
}
