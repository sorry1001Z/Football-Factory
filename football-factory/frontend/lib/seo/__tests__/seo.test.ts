// Tests — SEO bridge (Phase 2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonical, buildPostMetadata, buildNewsArticleJsonLd, getSiteUrl } from '../seo';

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

test('getSiteUrl: uses NEXT_PUBLIC_SITE_URL when set', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
  assert.equal(getSiteUrl(), 'https://test.example.com');
});

test('getSiteUrl: strips trailing slashes', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com/';
  assert.equal(getSiteUrl(), 'https://test.example.com');
});

test('buildCanonical: prepends base, accepts path', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
  assert.equal(buildCanonical('/news/x'), 'https://test.example.com/news/x');
  assert.equal(buildCanonical('news/x'), 'https://test.example.com/news/x');
});

test('buildPostMetadata: uses SEO fields when present', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
  const m = buildPostMetadata({
    post: {
      id: 'p.1',
      databaseId: 1,
      slug: 'x',
      uri: '/news/x/',
      title: 'Title',
      excerpt: 'Excerpt',
      content: '',
      date: '2026-09-08T00:00:00',
      modified: null,
      status: 'publish',
      featuredImage: null,
      author: null,
      categories: [],
      tags: [],
      seo: {
        title: 'SEO Title',
        description: 'SEO Desc',
        canonical: 'https://other/x',
        robots: null,
        openGraphTitle: null,
        openGraphDescription: null,
        openGraphImage: null,
        twitterTitle: null,
        twitterDescription: null,
        twitterImage: null,
        schemaRaw: null,
      },
      canonical: null,
    },
    path: '/news/x',
  });
  assert.equal(m.title, 'SEO Title');
  assert.equal(m.description, 'SEO Desc');
  assert.equal(m.alternates?.canonical, 'https://other/x');
});

test('buildPostMetadata: falls back to post title when SEO empty', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
  const m = buildPostMetadata({
    post: {
      id: 'p.2',
      databaseId: null,
      slug: 'y',
      uri: '/news/y/',
      title: 'Real Title',
      excerpt: 'Real Excerpt',
      content: '',
      date: null,
      modified: null,
      status: 'publish',
      featuredImage: null,
      author: null,
      categories: [],
      tags: [],
      seo: null,
      canonical: null,
    },
    path: '/news/y',
  });
  assert.equal(m.title, 'Real Title');
  assert.equal(m.description, 'Real Excerpt');
  assert.equal(m.alternates?.canonical, 'https://test.example.com/news/y');
});

test('buildPostMetadata: openGraph uses canonical URL', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
  const m = buildPostMetadata({
    post: {
      id: 'p.3',
      databaseId: null,
      slug: 'z',
      uri: '/news/z/',
      title: 'Z',
      excerpt: '',
      content: '',
      date: null,
      modified: null,
      status: 'publish',
      featuredImage: null,
      author: null,
      categories: [],
      tags: [],
      seo: null,
      canonical: null,
    },
    path: '/news/z',
  });
  assert.equal(m.openGraph?.url, 'https://test.example.com/news/z');
});

test('buildNewsArticleJsonLd: produces valid structure', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
  const ld = buildNewsArticleJsonLd({
    id: 'p.4',
    databaseId: null,
    slug: 'a',
    uri: '/news/a/',
    title: 'A',
    excerpt: 'B',
    content: '',
    date: '2026-09-08T00:00:00',
    modified: null,
    status: 'publish',
    featuredImage: null,
    author: { id: 'u.1', slug: 'jane', name: 'Jane', description: '', avatarUrl: null },
    categories: [{ id: 'c.1', slug: 'pl', name: 'PL', description: '' }],
    tags: [],
    seo: null,
    canonical: null,
  }, '/news/a');
  assert.equal(ld['@type'], 'NewsArticle');
  assert.equal(ld.headline, 'A');
  assert.equal(ld.author?.['@type'], 'Person');
});

// Restore env at the end
test('restore env', () => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});
