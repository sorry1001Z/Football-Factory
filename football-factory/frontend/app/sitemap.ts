// Football Factory — Sitemap (Phase 3 live content)
//
// Async, defensive. Always renders the static site map pages. When
// WordPress is reachable, the published-post list from WPGraphQL is
// merged in (deduped against mock and against itself). When WordPress
// is unreachable, empty, or unconfigured, the sitemap falls back to
// the mock-only list. WP failure NEVER breaks the sitemap.
//
// Canonical hostname policy:
// - Public URLs are always assembled via `getSiteUrl()`, which reads
//   `NEXT_PUBLIC_SITE_URL` and defaults to the Vercel production host.
// - The CMS-hostname (CMS / trycloudflare / InfinityFree / localhost)
//   is never written into the sitemap. WPGraphQL output is consumed
//   for the *list of slugs*, not their hosts.

import type { MetadataRoute } from "next";
import { mockNews, mockMatches } from "@/lib/mock-data";
import { getSiteUrl } from "@/lib/seo/seo";
import { normalizeWordPressPost } from "@/lib/wordpress/normalize";
import { WP_QUERY_POSTS } from "@/lib/wordpress/queries";
import { WordPressClient } from "@/lib/wordpress/client";

/**
 * Cap the number of published posts we pull from WordPress for the
 * sitemap. The brief asks for the live article to participate; we are
 * conservative on volume during the early pilot.
 */
const SITEMAP_WP_LIMIT = 100;

interface RawPostsResponse {
  posts: { nodes: unknown[] } | null;
}

/**
 * Single source of truth for "is WordPress usable right now?". Reused
 * by both the sitemap (here) and tests in `lib/seo/__tests__`.
 */
let _client: WordPressClient | null = null;
function getSitemapClient(): WordPressClient {
  const override = getSitemapOverride();
  if (override) {
    setSitemapOverride(null);
    return override;
  }
  if (_client) return _client;
  _client = new WordPressClient();
  return _client;
}

/**
 * Internal: same override pattern as content-service so tests can
 * inject a deterministic client. Production never sets it.
 */
const SITEMAP_OVERRIDE_KEY = Symbol.for("football-factory.test.sitemap-client");
type GlobalWithSitemapOverride = typeof globalThis & {
  [key: symbol]: WordPressClient | null;
};
function getSitemapOverride(): WordPressClient | null {
  return (globalThis as GlobalWithSitemapOverride)[SITEMAP_OVERRIDE_KEY] ?? null;
}
function setSitemapOverride(c: WordPressClient | null): void {
  (globalThis as GlobalWithSitemapOverride)[SITEMAP_OVERRIDE_KEY] = c;
}

/** Test-only seam: inject a custom WordPressClient. */
export function __setSitemapClientForTest(client: WordPressClient | null): void {
  setSitemapOverride(client);
}

async function tryFetchWpSlugs(): Promise<string[]> {
  try {
    const client = getSitemapClient();
    if (!client.configured) return [];
    const data = await client.request<RawPostsResponse>({
      query: WP_QUERY_POSTS,
      variables: { first: SITEMAP_WP_LIMIT },
    });
    const nodes = data?.posts?.nodes ?? [];
    const slugs: string[] = [];
    for (const node of nodes) {
      const p = normalizeWordPressPost(node);
      if (p && p.slug) slugs.push(p.slug);
    }
    return slugs;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  // 1. Static + mock URLs always present.
  const staticUrl = { url: base, changeFrequency: "hourly" as const, priority: 1 };
  const matchUrls = mockMatches.map((m) => ({
    url: `${base}/match/${m.slug}`,
    changeFrequency: "hourly" as const,
    priority: 0.9,
  }));
  const mockNewsUrls = mockNews.map((p) => ({
    url: `${base}/news/${p.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // 2. Optional WP-published slugs.
  const wpSlugs = await tryFetchWpSlugs();
  const wpNewsUrls = wpSlugs.map((slug) => ({
    url: `${base}/news/${slug}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // 3. Dedupe by URL, preserving first occurrence (so mock entries
  //    that already include a slug keep their priority/order).
  const seen = new Set<string>();
  const merged: MetadataRoute.Sitemap = [];
  const ordered = [staticUrl, ...mockNewsUrls, ...wpNewsUrls, ...matchUrls];
  for (const entry of ordered) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    merged.push(entry);
  }

  return merged;
}
