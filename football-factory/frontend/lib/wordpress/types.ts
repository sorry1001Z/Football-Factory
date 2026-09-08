// Football Factory — WordPress data contract (Phase 2)
// Canonical types used by content-service.ts. Never expose raw WPGraphQL
// response objects to page components.

export type WordPressProvider = "wpgraphql";

/** Author info attached to a post. */
export interface WordPressAuthor {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  avatarUrl: string | null;
}

/** Category info. */
export interface WordPressCategory {
  id: string | null;
  slug: string;
  name: string;
  description: string;
}

/** Tag info. */
export interface WordPressTag {
  id: string | null;
  slug: string;
  name: string;
  description: string;
}

/** Featured media (image) info. */
export interface WordPressMedia {
  id: string | null;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType: string;
}

/** SEO metadata, normalised. Plugin-agnostic (Yoast, Rank Math, AIOSEO). */
export interface WordPressSeo {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  openGraphImage: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  schemaRaw: string | null;
}

/** Canonical post. */
export interface WordPressPost {
  id: string;
  databaseId: number | null;
  slug: string;
  uri: string;
  title: string;
  excerpt: string;
  content: string;
  date: string | null;        // ISO 8601
  modified: string | null;
  status: string;
  featuredImage: WordPressMedia | null;
  author: WordPressAuthor | null;
  categories: WordPressCategory[];
  tags: WordPressTag[];
  seo: WordPressSeo | null;
  canonical: string | null;
}

/** Content origin tag. Used for safe diagnostics and (later) UI badges. */
export type WordPressContentOrigin =
  | "wpgraphql"     // Live data from configured WordPress
  | "mock"         // Local mock fallback
  | "unconfigured" // No WordPress configured at all
  | "degraded";    // WordPress reachable but returned invalid/empty

/** Wrapper around canonical content for safe UI consumption. */
export interface WordPressContentSource<T> {
  origin: WordPressContentOrigin;
  fetchedAt: string;
  data: T;
  /** When origin != wpgraphql, why we fell back. Never contains secret. */
  degradedReason: string | null;
}
