// Tests — Content service fallback / WP integration
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHomepageNews, getArticleBySlug, getLiveScores, __setContentClientForTest } from '../content-service';
import { WordPressClient } from '../../wordpress/client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

test('getArticleBySlug: WP unconfigured -> mock hit', async () => {
  __setContentClientForTest(new WordPressClient({ endpoint: '' }));
  const r = await getArticleBySlug('man-utd-comeback');
  assert.equal(r.source.origin, 'unconfigured');
  assert.equal(r.newsItem?.slug, 'man-utd-comeback');
  assert.equal(r.post, null);
});

test('getArticleBySlug: unknown slug -> null', async () => {
  __setContentClientForTest(new WordPressClient({ endpoint: '' }));
  const r = await getArticleBySlug('does-not-exist-xyz');
  assert.equal(r.newsItem, null);
  assert.equal(r.post, null);
});

test('getArticleBySlug: WP success -> normalized post', async () => {
  // Use a slug that ALSO exists in mock so the fallback item is found;
  // otherwise getArticleBySlug short-circuits to 'unconfigured' before
  // ever consulting the WP client.
  __setContentClientForTest(new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: (async () => jsonResponse({
      data: {
        post: {
          id: 'p.1',
          slug: 'man-utd-comeback',
          title: 'Hello',
          excerpt: 'Excerpt',
          content: 'Body content here.',
          date: '2026-09-08T00:00:00',
          status: 'publish',
          categories: { nodes: [{ name: 'PL', slug: 'pl' }] },
        },
      },
    })) as unknown as typeof fetch,
  }));
  const r = await getArticleBySlug('man-utd-comeback');
  assert.equal(r.source.origin, 'wpgraphql');
  assert.equal(r.post?.title, 'Hello');
  assert.equal(r.post?.content, 'Body content here.');
  assert.equal(r.newsItem?.category, 'PL');
});

test('getLiveScores: always returns mock with mock origin', async () => {
  __setContentClientForTest(new WordPressClient({ endpoint: '' }));
  const r = await getLiveScores();
  assert.equal(r.source.origin, 'mock');
  assert.equal(r.matches.length > 0, true);
});

// Reset to default (unconfigured) so other test files start clean.
test('reset content client for test isolation', () => {
  __setContentClientForTest(null);
});
