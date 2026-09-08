// Football Factory — Content Service (Phase 2)
// The ONLY public content API for page components. Wraps WordPress
// client with safe fallback, content origin tag, and a stable canonical
// hostname prefix for SEO.

import type { NewsItem, MatchItem } from "@/lib/types";
import { mockNews, mockMatches } from "@/lib/mock-data";
import { WordPressClient, WordPressClientError } from "@/lib/wordpress/client";
import { normalizeWordPressPost } from "@/lib/wordpress/normalize";
import { WP_QUERY_POSTS, WP_QUERY_POST_BY_SLUG } from "@/lib/wordpress/queries";
import type { WordPressContentSource, WordPressPost } from "@/lib/wordpress/types";

const HOMEPAGE_NEWS_LIMIT = 20;

/**
 * Default singleton client. Reads WORDPRESS_GRAPHQL_URL on first use.
 * Tests can override via __setContentClientForTest.
 */
let _client: WordPressClient | null = null;

/**
 * Build a content client. Reads the test-only override from
 * globalThis so module-instance differences between test code and
 * content-service cannot cause state drift. Production never sets
 * the override slot.
 */
function getClient(): WordPressClient {
  const override = getOverrideSlot();
  if (override) {
    // Consume-once semantics for test isolation.
    setOverrideSlot(null);
    return override;
  }
  if (_client) return _client;
  _client = new WordPressClient();
  return _client;
}

/**
 * For tests: inject a custom client. Production never uses this.
 */
export function __setContentClientForTest(client: WordPressClient | null): void {
  setOverrideSlot(client);
}

interface RawPostsResponse {
  posts: { nodes: unknown[] } | null;
}

interface RawPostBySlugResponse {
  post: unknown;
}

/**
 * Shared test-only override slot. We use `globalThis` so that the
 * test runner's module instance and the content-service module instance
 * see the same value, regardless of how tsx resolves path aliases.
 * Production code never touches this slot.
 */
const TEST_OVERRIDE_KEY = Symbol.for("football-factory.test.content-client");
type GlobalWithOverride = typeof globalThis & {
  [key: symbol]: WordPressClient | null;
};
function getOverrideSlot(): WordPressClient | null {
  return (globalThis as GlobalWithOverride)[TEST_OVERRIDE_KEY] ?? null;
}
function setOverrideSlot(c: WordPressClient | null): void {
  (globalThis as GlobalWithOverride)[TEST_OVERRIDE_KEY] = c;
}

function postToNewsItem(post: WordPressPost): NewsItem {
  const category =
    post.categories.length > 0 ? post.categories[0].name : "ข่าวฟุตบอล";
  return {
    slug: post.slug,
    title: post.title || post.slug,
    excerpt: post.excerpt,
    category,
    publishedAt: post.date
      ? new Date(post.date).toLocaleDateString("th-TH")
      : "",
    image: post.featuredImage?.url,
  };
}

function pickFirstCategoryCategory(categories: { name: string }[]): string {
  return categories.length > 0 ? categories[0].name : "ข่าวฟุตบอล";
}

function isDegraded(err: unknown): boolean {
  if (err && typeof err === "object" && "kind" in err) {
    const k = (err as { kind: string }).kind;
    return k !== "UNCONFIGURED";
  }
  return true;
}

function reasonFor(err: unknown): string {
  // Duck-type rather than `instanceof`: under test conditions the
  // WordPressClientError class is loaded via two different module paths
  // (direct + barrel), which can produce two distinct class objects.
  if (err && typeof err === "object" && "kind" in err && typeof (err as { kind: unknown }).kind === "string") {
    return (err as { kind: string }).kind;
  }
  if (err instanceof Error) return "UNKNOWN";
  return "UNKNOWN";
}

// ----- public API ------------------------------------------------------------

export interface HomepageNewsResult {
  lead: NewsItem;     // for the hero 1-large card
  side: NewsItem[];   // for the right-side 2x2 grid
  latest: NewsItem[]; // for the Latest News 2 cols x 5 rows
  source: WordPressContentSource<"wpgraphql" | "mock" | "unconfigured" | "degraded">;
}

export async function getHomepageNews(): Promise<HomepageNewsResult> {
  const fallback: HomepageNewsResult = {
    lead: mockNews[0],
    side: mockNews.slice(1, 5),
    latest: mockNews.slice(0, 10),
    source: {
      origin: "mock",
      fetchedAt: new Date().toISOString(),
      data: "mock",
      degradedReason: null,
    },
  };

  const client = getClient();
  if (!client.configured) {
    return {
      ...fallback,
      source: {
        origin: "unconfigured",
        fetchedAt: new Date().toISOString(),
        data: "unconfigured",
        degradedReason: null,
      },
    };
  }

  try {
    const data = await client.request<RawPostsResponse>({
      query: WP_QUERY_POSTS,
      variables: { first: HOMEPAGE_NEWS_LIMIT },
    });
    if (typeof process !== "undefined" && process.env?.FF_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("[content-service] getHomepageNews: data.posts nodes count=",
        data.posts?.nodes?.length ?? "no posts");
    }
    const nodes = data.posts?.nodes ?? [];
    const posts: WordPressPost[] = [];
    for (const node of nodes) {
      const p = normalizeWordPressPost(node);
      if (p) posts.push(p);
    }
    if (posts.length === 0) {
      return {
        ...fallback,
        source: {
          origin: "degraded",
          fetchedAt: new Date().toISOString(),
          data: "degraded",
          degradedReason: "EMPTY_RESPONSE",
        },
      };
    }
    const items: NewsItem[] = posts.map(postToNewsItem);
    if (typeof process !== "undefined" && process.env?.FF_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("[content-service] getHomepageNews: items[0]=", items[0]);
    }
    const lead = items[0];
    const side = items.slice(1, 5);
    const latest = items.slice(0, 10);
    while (side.length < 4 && latest.length < 10) {
      // Pad with mocks if WordPress returned too few posts
      const idx = side.length + 1;
      if (mockNews[idx]) side.push(mockNews[idx]);
      if (latest.length < 10 && mockNews[latest.length]) latest.push(mockNews[latest.length]);
      if (side.length >= 4 && latest.length >= 10) break;
    }
    return {
      lead,
      side,
      latest,
      source: {
        origin: "wpgraphql",
        fetchedAt: new Date().toISOString(),
        data: "wpgraphql",
        degradedReason: null,
      },
    };
  } catch (err) {
    if (typeof process !== "undefined" && process.env?.FF_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("[content-service] getHomepageNews err:", err);
    }
    return {
      ...fallback,
      source: {
        origin: "degraded",
        fetchedAt: new Date().toISOString(),
        data: "degraded",
        degradedReason: reasonFor(err),
      },
    };
  }
}

export interface ArticleResult {
  post: WordPressPost | null;
  newsItem: NewsItem | null; // for the listing-side surfaces
  source: WordPressContentSource<"wpgraphql" | "mock" | "unconfigured" | "degraded">;
}

export async function getArticleBySlug(slug: string): Promise<ArticleResult> {
  const fallbackItem: NewsItem | null =
    mockNews.find((n) => n.slug === slug) ?? null;

  if (!fallbackItem) {
    return {
      post: null,
      newsItem: null,
      source: {
        origin: "unconfigured",
        fetchedAt: new Date().toISOString(),
        data: "unconfigured",
        degradedReason: null,
      },
    };
  }

  const client = getClient();
  if (!client.configured) {
    return {
      post: null,
      newsItem: fallbackItem,
      source: {
        origin: "unconfigured",
        fetchedAt: new Date().toISOString(),
        data: "unconfigured",
        degradedReason: null,
      },
    };
  }

  try {
    const data = await client.request<RawPostBySlugResponse>({
      query: WP_QUERY_POST_BY_SLUG,
      variables: { slug },
    });
    const post = normalizeWordPressPost(data.post);
    if (!post) {
      return {
        post: null,
        newsItem: fallbackItem,
        source: {
          origin: "degraded",
          fetchedAt: new Date().toISOString(),
          data: "degraded",
          degradedReason: "EMPTY_POST",
        },
      };
    }
    return {
      post,
      newsItem: postToNewsItem(post),
      source: {
        origin: "wpgraphql",
        fetchedAt: new Date().toISOString(),
        data: "wpgraphql",
        degradedReason: null,
      },
    };
  } catch (err) {
    if (isDegraded(err)) {
      return {
        post: null,
        newsItem: fallbackItem,
        source: {
          origin: "degraded",
          fetchedAt: new Date().toISOString(),
          data: "degraded",
          degradedReason: reasonFor(err),
        },
      };
    }
    // UNCONFIGURED race: treat as unconfigured.
    return {
      post: null,
      newsItem: fallbackItem,
      source: {
        origin: "unconfigured",
        fetchedAt: new Date().toISOString(),
        data: "unconfigured",
        degradedReason: null,
      },
    };
  }
}

export interface MatchListResult {
  matches: MatchItem[];
  source: WordPressContentSource<"wpgraphql" | "mock" | "unconfigured" | "degraded">;
}

export async function getLiveScores(): Promise<MatchListResult> {
  // Phase 2 keeps the match list on the local mock. Live score polling
  // from WordPress is a future-phase responsibility.
  return {
    matches: mockMatches,
    source: {
      origin: "mock",
      fetchedAt: new Date().toISOString(),
      data: "mock",
      degradedReason: null,
    },
  };
}

// Re-export category first category selector for tests
export const __test__ = { postToNewsItem, pickFirstCategoryCategory, isDegraded, reasonFor };
