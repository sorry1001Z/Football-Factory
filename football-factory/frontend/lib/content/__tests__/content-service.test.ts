// Tests — Content service fallback / WP integration
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHomepageNews, getArticleBySlug, getLiveScores, __setContentClientForTest } from '../content-service';
import { WordPressClient } from '../../wordpress/client';
import { mockNews } from '../../mock-data';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Reset to default (unconfigured) so other test files start clean.
test('reset content client (declared early so isolation is enforced for all subsequent tests)', () => {
  __setContentClientForTest(null);
});

// ---------------------------------------------------------------------------
// getHomepageNews
// ---------------------------------------------------------------------------

test('WP unconfigured -> mock fallback (unconfigured origin)', async () => {
  __setContentClientForTest(new WordPressClient({ endpoint: '' }));
  const r = await getHomepageNews();
  assert.equal(r.source.origin, 'unconfigured');
  assert.equal(r.lead.title.length > 0, true);
  assert.equal(r.latest.length, 10);
  assert.equal(r.side.length, 4);
});

test('WP failure -> degraded fallback (mock content)', async () => {
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch,
  }));
  const r = await getHomepageNews();
  assert.equal(r.source.origin, 'degraded');
  assert.equal(r.lead.title.length > 0, true);
});

test('WP empty response -> degraded fallback', async () => {
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => jsonResponse({ data: { posts: { nodes: [] } } })) as unknown as typeof fetch,
  }));
  const r = await getHomepageNews();
  assert.equal(r.source.origin, 'degraded');
});

test('WP success -> wpgraphql origin, normalized items', async () => {
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => jsonResponse({
      data: {
        posts: {
          nodes: [
            {
              id: 'p.1',
              slug: 'hello',
              title: 'Hello World',
              excerpt: 'Excerpt',
              date: '2026-09-08T00:00:00',
              categories: { nodes: [{ name: 'PL', slug: 'pl' }] },
            },
            {
              id: 'p.2',
              slug: 'second',
              title: 'Second',
              excerpt: 'Second Excerpt',
              date: '2026-09-07T00:00:00',
              categories: { nodes: [{ name: 'LL', slug: 'll' }] },
            },
            {
              id: 'p.3',
              slug: 'third',
              title: 'Third',
              excerpt: 'Third Excerpt',
              date: '2026-09-06T00:00:00',
              categories: { nodes: [{ name: 'SA', slug: 'sa' }] },
            },
            {
              id: 'p.4',
              slug: 'fourth',
              title: 'Fourth',
              excerpt: 'Fourth Excerpt',
              date: '2026-09-05T00:00:00',
              categories: { nodes: [{ name: 'BL', slug: 'bl' }] },
            },
            {
              id: 'p.5',
              slug: 'fifth',
              title: 'Fifth',
              excerpt: 'Fifth Excerpt',
              date: '2026-09-04T00:00:00',
              categories: { nodes: [{ name: 'L1', slug: 'l1' }] },
            },
          ],
        },
      },
    })) as unknown as typeof fetch,
  }));
  const r = await getHomepageNews();
  if (typeof process !== "undefined" && process.env?.FF_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log("[test] r.source.origin=", r.source.origin,
      "r.lead.title=", r.lead?.title,
      "r.degradedReason=", r.source.degradedReason);
  }
  assert.equal(r.source.origin, 'wpgraphql');
  assert.equal(r.lead.title, 'Hello World');
  assert.equal(r.lead.category, 'PL');
  assert.equal(r.side.length, 4);
  assert.equal(r.latest.length, 5);
});

// ---------------------------------------------------------------------------
// getArticleBySlug — WP-first contract (Phase 3)
//
// Contract:
// - WP configured + WP returns a valid post -> wpgraphql, post set.
// - WP configured + WP returns no post       -> degraded + mock fallback
//                                              (or null if no mock match).
// - WP configured + WP throws (non-UNCONF)   -> degraded + mock fallback
//                                              (or degraded + null).
// - WP configured + WP throws UNCONFIGURED   -> unconfigured + mock fallback.
// - WP NOT configured                         -> unconfigured + mock fallback
//                                              (or unconfigured + null).
// ---------------------------------------------------------------------------

test('getArticleBySlug: WP unconfigured + slug-in-mock -> mock hit', async () => {
  __setContentClientForTest(new WordPressClient({ endpoint: '' }));
  const slug = mockNews[0].slug; // e.g. 'man-utd-comeback'
  const r = await getArticleBySlug(slug);
  assert.equal(r.source.origin, 'unconfigured');
  assert.equal(r.newsItem?.slug, slug);
  assert.equal(r.post, null);
});

test('getArticleBySlug: WP unconfigured + slug-NOT-in-mock -> null', async () => {
  __setContentClientForTest(new WordPressClient({ endpoint: '' }));
  const r = await getArticleBySlug('does-not-exist-xyz');
  assert.equal(r.source.origin, 'unconfigured');
  assert.equal(r.newsItem, null);
  assert.equal(r.post, null);
});

test('getArticleBySlug: WP success + slug-NOT-in-mock -> wpgraphql', async () => {
  // Critical new behavior: a slug that does not exist in mockNews can now
  // still resolve from WordPress and produce a normalized post.
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => jsonResponse({
      data: {
        post: {
          id: 'wp.99',
          slug: 'phase-3-test',
          title: 'Football Factory Phase 3 Test',
          excerpt: 'Live WP excerpt.',
          content: 'Live body.',
          date: '2026-09-09T08:00:00',
          status: 'publish',
          categories: { nodes: [{ name: 'Test News', slug: 'test-news' }] },
        },
      },
    })) as unknown as typeof fetch,
  }));
  const r = await getArticleBySlug('phase-3-test');
  assert.equal(r.source.origin, 'wpgraphql');
  assert.equal(r.post?.slug, 'phase-3-test');
  assert.equal(r.post?.title, 'Football Factory Phase 3 Test');
  assert.equal(r.post?.content, 'Live body.');
  assert.equal(r.newsItem?.category, 'Test News');
});

test('getArticleBySlug: WP success + slug-NOT-in-mock but WP returns null -> degraded + null', async () => {
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => jsonResponse({ data: { post: null } })) as unknown as typeof fetch,
  }));
  const r = await getArticleBySlug('phase-3-test');
  // WP is configured; gracefully empty WP response; no mock match.
  assert.equal(r.source.origin, 'degraded');
  assert.equal(r.source.degradedReason, 'EMPTY_POST');
  assert.equal(r.post, null);
  assert.equal(r.newsItem, null);
});

test('getArticleBySlug: WP failure + slug-in-mock -> degraded + mock hit', async () => {
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch,
  }));
  const slug = mockNews[0].slug;
  const r = await getArticleBySlug(slug);
  assert.equal(r.source.origin, 'degraded');
  assert.equal(r.newsItem?.slug, slug);
  assert.equal(r.post, null);
});

test('getArticleBySlug: WP failure + slug-NOT-in-mock -> degraded + null (page can 404)', async () => {
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => new Response('boom', { status: 503 })) as unknown as typeof fetch,
  }));
  const r = await getArticleBySlug('phase-3-test');
  assert.equal(r.source.origin, 'degraded');
  assert.equal(r.post, null);
  assert.equal(r.newsItem, null);
});

test('getArticleBySlug: WP returns valid post for slug that ALSO exists in mock -> WP wins', async () => {
  // Pre-existing test from Phase 2 — same shape, same expectation: WP
  // overrides the mock entry when WP has the post.
  const slug = mockNews[0].slug;
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => jsonResponse({
      data: {
        post: {
          id: 'wp.1',
          slug,
          title: 'WP Title WINS',
          excerpt: 'WP excerpt',
          content: 'WP body',
          date: '2026-09-08T00:00:00',
          status: 'publish',
          categories: { nodes: [{ name: 'PL', slug: 'pl' }] },
        },
      },
    })) as unknown as typeof fetch,
  }));
  const r = await getArticleBySlug(slug);
  assert.equal(r.source.origin, 'wpgraphql');
  assert.equal(r.post?.title, 'WP Title WINS');
  assert.equal(r.post?.content, 'WP body');
  // newsItem is derived from WP, not the mock, when WP wins.
  assert.equal(r.newsItem?.title, 'WP Title WINS');
  assert.equal(r.newsItem?.category, 'PL');
  // The mock entry for this slug must NOT have leaked into the result.
  assert.notEqual(r.newsItem?.title, mockNews.find((m) => m.slug === slug)?.title);
});

// ---------------------------------------------------------------------------
// getLiveScores
// ---------------------------------------------------------------------------

test('getLiveScores: always returns mock with mock origin', async () => {
  __setContentClientForTest(new WordPressClient({ endpoint: '' }));
  const r = await getLiveScores();
  assert.equal(r.source.origin, 'mock');
  assert.equal(r.matches.length > 0, true);
});

// Final reset.
test('reset content client for test isolation', () => {
  __setContentClientForTest(null);
});
