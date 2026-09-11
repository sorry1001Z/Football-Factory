// Football Factory — SEO Entity Hub types (R2 Wave 2B).
//
// Adapted from external SEO Entity Hub V2 R2 pack (src/types.ts)
// with one IMPORTANT change: the live repo's canonical_id and
// provider_id discipline is preserved. Provider-specific IDs are
// kept as a typed record (NOT flattened into ambiguous strings),
// so future slices that surface standings/fixtures can attribute
// every row back to its source.

/**
 * Cross-entity reference. Carries canonical_id + (optional) provider
 * + (optional) external_id so internal linking and JSON-LD can
 * attribute each entity to its source.
 */
export interface EntityRef {
  canonicalId: string; // e.g. "team:manchester-united"
  provider: string | null; // "football-data.org" | "api-football" | "seed" | null
  sourceId: string | null; // provider-native id, kept as STRING to avoid type-narrowing
  slug: string; // URL slug, used for routing
  name: string;
  logoUrl?: string | null;
  country?: string | null;
}

/**
 * Lightweight article reference used in entity-hub rails. The live
 * data model exposes the same slug + title + imageUrl via
 * ContentService.getHomepageNews; this type is the normalized
 * shape the hub pages consume.
 */
export interface ArticleRef {
  slug: string;
  title: string;
  publishedAt: string;
  imageUrl?: string | null;
}

/**
 * A single match reference. Mirrors the commercial shell's
 * CommercialMatch but with no rights/image references (the hub
 * pages do NOT render images for fixtures).
 */
export interface HubMatchRef {
  id: string;
  homeTeamRef: EntityRef;
  awayTeamRef: EntityRef;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  kickoff: string;
}

/**
 * A standings row. Position + team + played + points.
 */
export interface HubStandingRow {
  pos: number;
  team: EntityRef;
  played: number;
  points: number;
}

/**
 * The Team Hub view model. Composed by lib/seo-entity/service.ts.
 */
export interface TeamHub {
  team: EntityRef;
  competition: EntityRef | null;
  latestNews: ArticleRef[];
  fixtures: HubMatchRef[];
  standing: HubStandingRow | null;
  relatedPlayers: EntityRef[];
  relatedArticles: ArticleRef[];
  source: {
    identity: "seed" | "provider" | "unresolved";
    news: "wpgraphql" | "mock" | "unconfigured" | "degraded";
    fixtures: "wpgraphql" | "mock" | "unconfigured" | "degraded" | "n/a";
    standings: "wpgraphql" | "mock" | "unconfigured" | "degraded" | "n/a";
  };
}

/**
 * The Competition Hub view model.
 */
export interface CompetitionHub {
  competition: EntityRef;
  latestNews: ArticleRef[];
  standings: HubStandingRow[];
  fixtures: HubMatchRef[];
  teams: EntityRef[];
  relatedArticles: ArticleRef[];
  source: {
    identity: "seed" | "provider" | "unresolved";
    news: "wpgraphql" | "mock" | "unconfigured" | "degraded";
    fixtures: "wpgraphql" | "mock" | "unconfigured" | "degraded" | "n/a";
    standings: "wpgraphql" | "mock" | "unconfigured" | "degraded" | "n/a";
  };
}

/**
 * Thin-page assessment. Used by the SEO bridge to decide whether
 * to emit `<meta name="robots" content="noindex">`.
 */
export interface ThinPageAssessment {
  isThin: boolean;
  itemCount: number;
  threshold: number;
}

/**
 * SeoBridge contract. The hub pages consume this; the bridge
 * delegates to the existing lib/seo/seo.ts helpers without
 * replacing them.
 */
export interface SeoBridgeOutput {
  canonical: string;
  title: string;
  description: string;
  noindex: boolean;
  breadcrumbs: Array<{ name: string; path: string }>;
  jsonLd: unknown;
}
