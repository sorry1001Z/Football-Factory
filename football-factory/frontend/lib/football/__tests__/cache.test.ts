// Tests — Cache (hit / miss / expiry / key stability)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache, buildCacheKey } from '../cache';

test('cache miss on first get', () => {
  const c = new MemoryCache();
  const r = c.get('nope');
  assert.equal(r.hit, false);
  assert.equal(r.freshness, 'miss');
});

test('cache hit after set, returns value', () => {
  const c = new MemoryCache<string>();
  c.set('k', 'hello', { ttl_ms: 1_000 });
  const r = c.get('k');
  assert.equal(r.hit, true);
  assert.equal(r.freshness, 'fresh');
  assert.equal(r.entry!.value, 'hello');
});

test('cache expiry after ttl', async () => {
  const c = new MemoryCache<string>();
  c.set('k', 'x', { ttl_ms: 20 });
  await new Promise((r) => setTimeout(r, 40));
  const r = c.get('k');
  assert.equal(r.hit, false);
  assert.equal(r.freshness, 'expired');
});

test('cache stale-while-revalidate: still hit when within stale window', async () => {
  const c = new MemoryCache<string>();
  c.set('k', 'x', { ttl_ms: 20, stale_ttl_ms: 100 });
  await new Promise((r) => setTimeout(r, 40));
  const r = c.get('k');
  assert.equal(r.hit, true);
  assert.equal(r.freshness, 'stale');
  assert.equal(r.entry!.value, 'x');
});

test('cache key stability: same inputs → same key', () => {
  const a = buildCacheKey(['v1', 'competitions', 'football-data.org', 'p=PL']);
  const b = buildCacheKey(['v1', 'competitions', 'football-data.org', 'p=PL']);
  assert.equal(a, b);
});

test('cache key differs by version / provider / param', () => {
  const base = buildCacheKey(['v1', 'competitions', 'football-data.org']);
  const v2 = buildCacheKey(['v2', 'competitions', 'football-data.org']);
  const af = buildCacheKey(['v1', 'competitions', 'api-football']);
  const q = buildCacheKey(['v1', 'competitions', 'football-data.org', 'q=foo']);
  assert.notEqual(base, v2);
  assert.notEqual(base, af);
  assert.notEqual(base, q);
});

test('cache stats reflects size and provider counts', () => {
  const c = new MemoryCache();
  c.set('a', 1, { ttl_ms: 1_000, provider: 'football-data.org' });
  c.set('b', 2, { ttl_ms: 1_000, provider: 'football-data.org' });
  c.set('c', 3, { ttl_ms: 1_000, provider: 'api-football' });
  const s = c.stats();
  assert.equal(s.size, 3);
  assert.equal(s.provider_counts!['football-data.org'], 2);
  assert.equal(s.provider_counts!['api-football'], 1);
});

test('cache delete works', () => {
  const c = new MemoryCache();
  c.set('k', 'v', { ttl_ms: 1_000 });
  assert.equal(c.delete('k'), true);
  assert.equal(c.delete('k'), false);
});

test('cache set rejects non-positive ttl', () => {
  const c = new MemoryCache();
  assert.throws(() => c.set('k', 'v', { ttl_ms: 0 }));
  assert.throws(() => c.set('k', 'v', { ttl_ms: -10 }));
  assert.throws(() => c.set('k', 'v', { ttl_ms: Number.NaN }));
});

test('cache stats never returns entry values (only counts)', () => {
  const c = new MemoryCache<string>();
  c.set('secret-key', 'SECRET-DO-NOT-ECHO', { ttl_ms: 1_000 });
  const s = JSON.stringify(c.stats());
  assert.equal(s.includes('SECRET-DO-NOT-ECHO'), false, 'cache stats leaked value');
});
