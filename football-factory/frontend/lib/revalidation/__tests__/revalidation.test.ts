// Tests — Revalidation bridge (Phase 2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPathAllowed,
  sanitizeRevalidatePaths,
  constantTimeEquals,
} from '../revalidation';

test('isPathAllowed: root and known prefixes are allowed', () => {
  assert.equal(isPathAllowed('/'), true);
  assert.equal(isPathAllowed('/news'), true);
  assert.equal(isPathAllowed('/news/some-slug'), true);
  assert.equal(isPathAllowed('/match/x'), true);
  assert.equal(isPathAllowed('/league/premier-league'), true);
  assert.equal(isPathAllowed('/sitemap.xml'), true);
  assert.equal(isPathAllowed('/robots.txt'), true);
});

test('isPathAllowed: rejects external or malicious paths', () => {
  assert.equal(isPathAllowed(''), false);
  assert.equal(isPathAllowed('news/x'), false);
  assert.equal(isPathAllowed('//evil.com'), false);
  assert.equal(isPathAllowed('/etc/passwd'), false);
  assert.equal(isPathAllowed('/../etc/passwd'), false);
  assert.equal(isPathAllowed('/admin'), false);
  assert.equal(isPathAllowed('/' + 'a'.repeat(300)), false);
  assert.equal(isPathAllowed('/news/\0bad'), false);
});

test('sanitizeRevalidatePaths: only keeps allowed paths', () => {
  const r = sanitizeRevalidatePaths([
    '/',
    '/news/x',
    '/etc/passwd',
    '//evil.com',
    '/match/y',
    '/admin',
  ]);
  assert.deepEqual(r.revalidated, ['/', '/news/x', '/match/y']);
  assert.equal(r.rejected.length, 3);
});

test('sanitizeRevalidatePaths: caps at 25', () => {
  const arr = Array.from({ length: 30 }, (_, i) => `/news/post-${i}`);
  const r = sanitizeRevalidatePaths(arr);
  assert.equal(r.revalidated.length, 25);
  assert.equal(r.rejected.length, 5);
});

test('sanitizeRevalidatePaths: dedupes', () => {
  const r = sanitizeRevalidatePaths(['/news/a', '/news/a', '/news/b']);
  assert.deepEqual(r.revalidated, ['/news/a', '/news/b']);
});

test('sanitizeRevalidatePaths: not array -> all rejected', () => {
  const r = sanitizeRevalidatePaths('not an array');
  assert.equal(r.ok, false);
  assert.equal(r.revalidated.length, 0);
});

test('sanitizeRevalidatePaths: non-string entries rejected', () => {
  const r = sanitizeRevalidatePaths(['/news/a', 42, null, '/news/b']);
  assert.deepEqual(r.revalidated, ['/news/a', '/news/b']);
  assert.equal(r.rejected.length, 2);
});

test('constantTimeEquals: equal strings -> true', () => {
  assert.equal(constantTimeEquals('abc', 'abc'), true);
  assert.equal(constantTimeEquals('', ''), true);
});

test('constantTimeEquals: different strings -> false', () => {
  assert.equal(constantTimeEquals('abc', 'abd'), false);
  assert.equal(constantTimeEquals('abc', 'ab'), false);
  assert.equal(constantTimeEquals('abc', 'ABCD'), false);
});

test('constantTimeEquals: null/undefined -> false', () => {
  assert.equal(constantTimeEquals(null, 'abc'), false);
  assert.equal(constantTimeEquals('abc', undefined), false);
  assert.equal(constantTimeEquals(null, null), false);
});
