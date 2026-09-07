// Tests — Provider Resolver
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProvider,
  isAllowedProvider,
  listAllowedProviders,
  ProviderResolutionError,
} from '../provider-resolver';

test('valid provider: football-data.org', () => {
  const p = resolveProvider('football-data.org');
  assert.equal(p.name, 'football-data.org');
});

test('valid provider: api-football', () => {
  const p = resolveProvider('api-football');
  assert.equal(p.name, 'api-football');
});

test('invalid provider throws ProviderResolutionError', () => {
  assert.throws(
    () => resolveProvider('openliga-db'),
    (err: unknown) => {
      assert.ok(err instanceof ProviderResolutionError);
      assert.equal((err as ProviderResolutionError).requested, 'openliga-db');
      return true;
    },
  );
});

test('isAllowedProvider: true for known names', () => {
  assert.equal(isAllowedProvider('football-data.org'), true);
  assert.equal(isAllowedProvider('api-football'), true);
});

test('isAllowedProvider: false for unknown / mock', () => {
  assert.equal(isAllowedProvider('mock'), false);
  assert.equal(isAllowedProvider(''), false);
  assert.equal(isAllowedProvider('openliga-db'), false);
});

test('listAllowedProviders returns exactly the two real providers', () => {
  const list = listAllowedProviders();
  assert.equal(list.length, 2);
  assert.ok(list.includes('football-data.org'));
  assert.ok(list.includes('api-football'));
});

test('resolver never serializes provider API keys', () => {
  // Inject a fake key; the resolver must not surface it via the returned
  // provider's stringification either.
  const p = resolveProvider('football-data.org', {
    api_keys: { 'football-data.org': 'SECRET-DO-NOT-ECHO-XYZ' },
  });
  const s = JSON.stringify(p);
  assert.equal(s.includes('SECRET-DO-NOT-ECHO-XYZ'), false,
    'API key leaked via JSON.stringify(provider)');
});
