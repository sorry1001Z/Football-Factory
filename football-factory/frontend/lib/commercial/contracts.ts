// Football Factory — Commercial Frontend contracts (R2 Wave 2A).
//
// Adapted from the external Commercial Frontend v3 R2 pack
// (src/contracts.ts) with the following changes:
//
//   1. SafeImage is REJECTED (would bypass Wave 1 rights gates).
//      Every image reference in this layer uses Wave 1's
//      `Asset` shape from `@/lib/image-system/types`.
//   2. ImageRef is renamed to CommercialImageRef and constrained
//      to Asset-derived fields only (no fabricated license strings).
//   3. Stage enum names match the live repo's canonical stage graph
//      (`editorial_created`, `ai_assist`, etc.) — not the Pack 01
//      kebab-case strings (`fact-review`, etc.).
//   4. Adapter-facing shapes are server-component safe; no
//      client-side fetching, no fake production content.

import type { Asset } from "@/lib/image-system/types";

/**
 * A commercial image reference. MUST resolve through Wave 1
 * `HeroNewsImage` / `NewsCoverImage` / `ArticleEditorialImage`.
 * Never bypass the rights gate.
 */
export interface CommercialImageRef {
  asset: Asset | undefined;
  sourcePolicyAttributionRequired?: boolean;
}

/**
 * Commercial news card shape. Mirrors the live `NewsItem` shape but
 * carries an `image: CommercialImageRef` (NOT a string URL).
 */
export interface CommercialNews {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  section: string;
  publishedAt: string;
  image: CommercialImageRef;
}

/**
 * Match strip card. Used by MatchStrip and FixturesWidget.
 */
export interface CommercialMatch {
  id: string;
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
  kickoff: string;
}

/**
 * A standings row. Position + team + played + points.
 */
export interface CommercialStanding {
  pos: number;
  team: string;
  p: number;
  pts: number;
}

/**
 * The full home page data shape. Server-component consumed by
 * app/page.tsx via the adapter.
 */
export interface HomeData {
  breaking: CommercialNews[];
  hero: CommercialNews[];
  latest: CommercialNews[];
  matches: CommercialMatch[];
  standings: CommercialStanding[];
  leagueSections: Array<{
    slug: string;
    label: string;
    items: CommercialNews[];
  }>;
  trending: CommercialNews[];
  editorsPick: CommercialNews[];
  teamHubStrip: Array<{
    slug: string;
    label: string;
    crest: string | null;
  }>;
  source: {
    origin: "wpgraphql" | "mock" | "unconfigured" | "degraded";
    data: "wpgraphql" | "mock" | "unconfigured" | "degraded";
    degradedReason: string | null;
  };
}

/**
 * The news list page data shape. Used by app/news/page.tsx.
 */
export interface NewsListData {
  items: CommercialNews[];
  total: number;
  page: number;
  pageSize: number;
  source: HomeData["source"];
}

/**
 * The search results page data shape. Used by app/search/page.tsx.
 *
 * NOTE: ContentService does NOT expose a search method today. When
 * `items.length === 0 && source.data === 'degraded'`, the search page
 * renders an Empty state explaining the limitation, NOT a fake result.
 */
export interface SearchData {
  query: string;
  items: CommercialNews[];
  total: number;
  available: boolean;
  source: HomeData["source"];
}

/**
 * An adapter-level error type. The adapter never throws; it always
 * returns a degraded shape so the page can render an ErrorState.
 */
export interface AdapterError {
  kind: "UPSTREAM" | "TIMEOUT" | "NETWORK" | "CONFIG" | "UNKNOWN";
  message: string;
}
