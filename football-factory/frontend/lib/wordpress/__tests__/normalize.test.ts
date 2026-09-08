// Tests — WordPress normalize functions
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtml,
  normalizeWordPressMedia,
  normalizeWordPressAuthor,
  normalizeWordPressCategory,
  normalizeWordPressTag,
  normalizeWordPressSeo,
  normalizeWordPressPost,
} from '../normalize';

test('stripHtml: removes tags and decodes entities', () => {
  assert.equal(stripHtml('<p>Hello <b>world</b></p>'), 'Hello world');
  assert.equal(stripHtml('A &amp; B &nbsp; C'), 'A & B C');
  assert.equal(stripHtml(''), '');
  assert.equal(stripHtml(42 as unknown as string), '');
});

test('normalizeWordPressMedia: null when no sourceUrl', () => {
  assert.equal(normalizeWordPressMedia(null), null);
  assert.equal(normalizeWordPressMedia({}), null);
});

test('normalizeWordPressMedia: extracts sourceUrl and mediaDetails', () => {
  const m = normalizeWordPressMedia({
    id: 'media.123',
    sourceUrl: 'https://example.com/img.jpg',
    altText: 'alt',
    mimeType: 'image/jpeg',
    mediaDetails: { width: 1200, height: 600 },
  });
  assert.equal(m?.url, 'https://example.com/img.jpg');
  assert.equal(m?.alt, 'alt');
  assert.equal(m?.width, 1200);
  assert.equal(m?.height, 600);
  assert.equal(m?.mimeType, 'image/jpeg');
});

test('normalizeWordPressAuthor: tolerates missing fields', () => {
  const a = normalizeWordPressAuthor({ name: 'Jane', slug: 'jane' });
  assert.equal(a?.name, 'Jane');
  assert.equal(a?.slug, 'jane');
  assert.equal(a?.avatarUrl, null);
});

test('normalizeWordPressAuthor: null when name missing', () => {
  assert.equal(normalizeWordPressAuthor({ slug: 'x' }), null);
});

test('normalizeWordPressCategory: skips nodes without name', () => {
  const c1 = normalizeWordPressCategory({ name: 'PL', slug: 'pl' });
  assert.equal(c1?.slug, 'pl');
  assert.equal(normalizeWordPressCategory({ slug: 'no-name' }), null);
});

test('normalizeWordPressTag: same shape as category', () => {
  const t = normalizeWordPressTag({ name: 'news', slug: 'news' });
  assert.equal(t?.name, 'news');
});

test('normalizeWordPressSeo: extracts og + twitter + schema', () => {
  const s = normalizeWordPressSeo({
    title: 'T',
    metaDesc: 'D',
    canonical: 'https://x/y',
    opengraphTitle: 'OG',
    opengraphDescription: 'OG-D',
    opengraphImage: { sourceUrl: 'https://x/og.jpg' },
    twitterTitle: 'TW',
    twitterDescription: 'TW-D',
    twitterImage: { sourceUrl: 'https://x/tw.jpg' },
    schema: { raw: '<script>...</script>' },
  });
  assert.equal(s?.title, 'T');
  assert.equal(s?.openGraphImage, 'https://x/og.jpg');
  assert.equal(s?.twitterImage, 'https://x/tw.jpg');
  assert.equal(s?.schemaRaw, '<script>...</script>');
});

test('normalizeWordPressPost: handles edge case (no id, no slug)', () => {
  assert.equal(normalizeWordPressPost({}), null);
  assert.equal(normalizeWordPressPost(null), null);
});

test('normalizeWordPressPost: produces canonical shape', () => {
  const p = normalizeWordPressPost({
    id: 'post.1',
    databaseId: 42,
    slug: 'hello',
    uri: '/news/hello/',
    title: 'Hello',
    excerpt: 'World',
    content: 'Body',
    date: '2026-09-08T00:00:00',
    modified: '2026-09-08T01:00:00',
    status: 'publish',
    featuredImage: { node: { sourceUrl: 'https://x/y.jpg' } },
    author: { node: { name: 'A', slug: 'a' } },
    categories: { nodes: [{ name: 'PL', slug: 'pl' }] },
    tags: { nodes: [{ name: 't', slug: 't' }] },
    seo: { title: 'T', metaDesc: 'D' },
  });
  assert.equal(p?.slug, 'hello');
  assert.equal(p?.databaseId, 42);
  assert.equal(p?.title, 'Hello');
  assert.equal(p?.author?.name, 'A');
  assert.equal(p?.categories.length, 1);
  assert.equal(p?.tags.length, 1);
  assert.equal(p?.seo?.title, 'T');
  assert.equal(p?.featuredImage?.url, 'https://x/y.jpg');
});

test('normalizeWordPressPost: malformed input does not throw', () => {
  // Pass various bad shapes; we must never throw.
  const bad = [null, undefined, 0, '', 'string', [], { weird: true }];
  for (const b of bad) {
    normalizeWordPressPost(b); // expect null or a partial result
  }
});
