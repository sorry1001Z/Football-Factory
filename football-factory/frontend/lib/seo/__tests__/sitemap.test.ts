// Tests — sitemap generator (Phase 3)
//
// The sitemap module is async and depends on WordPress. We inject a
// deterministic WordPressClient via `__setSitemapClientForTest`
// (same pattern as content-service). The client can be configured
// with a custom fetchImpl so we never hit the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockNews, mockMatches } from '../../mock-data';

function jsonResp(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// ---------------------------------------------------------------------------
// Sanity / isolation
// ---------------------------------------------------------------------------

test('reset sitemap client (declared early to isolate the rest)', async () => {
  const { __setSitemapClientForTest } = await import('../../../app/sitemap');
  __setSitemapClientForTest(null);
});

// ---------------------------------------------------------------------------
// Mock-only paths (no WP configured)
// ---------------------------------------------------------------------------

test('sitemap: WP unconfigured -> mock-only sitemap, canonical host = NEXT_PUBLIC_SITE_URL', async () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example-pilot.test';
  try {
    const { __setSitemapClientForTest } = await import('../../../app/sitemap');
    const { WordPressClient } = await import('../../wordpress/client');
    __setSitemapClientForTest(new WordPressClient({ endpoint: '' }));
    const { default: sitemap } = await import('../../../app/sitemap');
    const out = await sitemap();
    const urls = out.map((e) => e.url);
    assert.ok(urls.includes('https://example-pilot.test'), 'sitemap must include the public base URL');
    assert.ok(urls.includes(`https://example-pilot.test/match/${mockMatches[0].slug}`), 'sitemap must include match URLs');
    for (const m of mockNews) {
      assert.ok(urls.includes(`https://example-pilot.test/news/${m.slug}`), 'sitemap must include mock news URLs');
    }
    // No localhost, trycloudflare, InfinityFree, or any other host leaked.
    for (const u of urls) {
      assert.equal(u.startsWith('https://example-pilot.test'), true, `unexpected host in sitemap url: ${u}`);
    }
    // No duplicates.
    const seen = new Set<string>();
    for (const u of urls) {
      assert.equal(seen.has(u), false, `duplicate url: ${u}`);
      seen.add(u);
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  }
});

test('sitemap: WP unreachable (fetch throws) -> mock-only sitemap, never throws', async () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example-pilot.test';
  try {
    const { __setSitemapClientForTest } = await import('../../../app/sitemap');
    const { WordPressClient } = await import('../../wordpress/client');
    const client = new WordPressClient({
      endpoint: 'https://example.com/graphql',
      fetchImpl: (async () => { throw new Error('network down'); }) as unknown as typeof fetch,
    });
    __setSitemapClientForTest(client);
    const { default: sitemap } = await import('../../../app/sitemap');
    const out = await sitemap();
    const urls = out.map((e) => e.url);
    for (const m of mockNews) {
      assert.ok(urls.includes(`https://example-pilot.test/news/${m.slug}`));
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  }
});

test('sitemap: WP success -> WP slugs included AND mocked slugs still present, deduped', async () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example-pilot.test';
  try {
    const wpSlugs = [mockNews[0].slug, 'wp-only-phase-3-test'];
    const { __setSitemapClientForTest } = await import('../../../app/sitemap');
    const { WordPressClient } = await import('../../wordpress/client');
    const client = new WordPressClient({
      endpoint: 'https://example.com/graphql',
      fetchImpl: (async () =>
        jsonResp({
          data: {
            posts: {
              nodes: wpSlugs.map((slug, i) => ({
                id: `wp.${i}`,
                slug,
                title: `WP ${slug}`,
                excerpt: 'wp excerpt',
                date: '2026-09-09T08:00:00',
                categories: { nodes: [{ name: 'Cat', slug: 'cat' }] },
              })),
            },
          },
        })
      ) as unknown as typeof fetch,
    });
    __setSitemapClientForTest(client);
    const { default: sitemap } = await import('../../../app/sitemap');
    const out = await sitemap();
    const urls = out.map((e) => e.url);
    const base = 'https://example-pilot.test';
    for (const m of mockNews) {
      assert.ok(urls.includes(`${base}/news/${m.slug}`));
    }
    assert.ok(urls.includes(`${base}/news/wp-only-phase-3-test`), 'WP-only slug must be in the sitemap');
    const dupCount = urls.filter((u) => u === `${base}/news/${mockNews[0].slug}`).length;
    assert.equal(dupCount, 1, 'shared slug must be deduped');
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  }
});

test('sitemap: WP returns empty posts -> mock-only sitemap, no errors, no duplicates', async () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example-pilot.test';
  try {
    const { __setSitemapClientForTest } = await import('../../../app/sitemap');
    const { WordPressClient } = await import('../../wordpress/client');
    const client = new WordPressClient({
      endpoint: 'https://example.com/graphql',
      fetchImpl: (async () => jsonResp({ data: { posts: { nodes: [] } } })) as unknown as typeof fetch,
    });
    __setSitemapClientForTest(client);
    const { default: sitemap } = await import('../../../app/sitemap');
    const out = await sitemap();
    const urls = out.map((e) => e.url);
    for (const m of mockNews) {
      assert.ok(urls.includes(`https://example-pilot.test/news/${m.slug}`));
    }
    const seen = new Set<string>();
    for (const u of urls) {
      assert.equal(seen.has(u), false);
      seen.add(u);
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  }
});

test('sitemap: canonical hostname safety — never emit localhost, trycloudflare, InfinityFree, or CMS host', async () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const { __setSitemapClientForTest } = await import('../../../app/sitemap');
    const { WordPressClient } = await import('../../wordpress/client');
    const client = new WordPressClient({
      endpoint: 'https://example.com/graphql',
      fetchImpl: (async () =>
        jsonResp({
          data: {
            posts: {
              nodes: [
                {
                  id: 'wp.1',
                  slug: 'phase-3-test',
                  title: 'Football Factory Phase 3 Test',
                  excerpt: 'Live',
                  date: '2026-09-09T08:00:00',
                  categories: { nodes: [{ name: 'Test', slug: 'test' }] },
                },
              ],
            },
          },
        })
      ) as unknown as typeof fetch,
    });
    __setSitemapClientForTest(client);
    const { default: sitemap } = await import('../../../app/sitemap');
    const out = await sitemap();
    const urls = out.map((e) => e.url);
    for (const u of urls) {
      for (const forbidden of ['localhost', 'trycloudflare', 'infy.click', 'cms.footballfactoryth']) {
        assert.equal(
          u.includes(forbidden),
          false,
          `forbidden host fragment '${forbidden}' present in sitemap url: ${u}`,
        );
      }
    }
    const defaultBase = 'https://football-factory-three.vercel.app';
    assert.ok(urls.includes(defaultBase), 'sitemap must include the default public base when NEXT_PUBLIC_SITE_URL is unset');
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  }
});

test('reset sitemap client for test isolation', async () => {
  const { __setSitemapClientForTest } = await import('../../../app/sitemap');
  __setSitemapClientForTest(null);
});
