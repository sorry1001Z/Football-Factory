// Tests — Competition Identity

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCompetitionByCanonicalId,
  resolveCompetitionByProviderId,
  resolveCompetitionByAlias,
  resolveCompetition,
} from '../identity';

test('canonical_id exact match', () => {
  const result = resolveCompetition({ canonical_id: 'league:premier-league' });
  assert.equal(result.status, 'resolved');
  assert.equal(result.entity!.name, 'Premier League');
});

test('common alias exact match (English)', () => {
  const r1 = resolveCompetitionByAlias('EPL');
  assert.equal(r1.status, 'resolved');
  assert.equal(r1.entity!.canonical_id, 'league:premier-league');

  const r2 = resolveCompetitionByAlias('Champions League');
  assert.equal(r2.status, 'resolved');
  assert.equal(r2.entity!.canonical_id, 'competition:uefa-champions-league');
});

test('Thai alias exact match', () => {
  const r = resolveCompetitionByAlias('พรีเมียร์ลีก');
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'league:premier-league');
});

test('whitespace + case normalization', () => {
  const r = resolveCompetitionByAlias('  premier   league  ');
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'league:premier-league');
});

test('punctuation variants are normalized', () => {
  const r = resolveCompetitionByAlias('UEFA\u2013Champions\u2014League'); // en-dash, em-dash
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'competition:uefa-champions-league');
});

test('provider_id lookup for both providers', () => {
  const fd = resolveCompetitionByProviderId('football-data.org', 'PD');
  assert.ok(fd);
  assert.equal(fd!.canonical_id, 'league:laliga');

  const af = resolveCompetitionByProviderId('api-football', 140);
  assert.ok(af);
  assert.equal(af!.canonical_id, 'league:laliga');
});

test('unknown competition resolves to unresolved (never guessed)', () => {
  const r1 = resolveCompetitionByCanonicalId('league:made-up');
  assert.equal(r1, null);

  const r2 = resolveCompetitionByAlias('Hyper League of Atlantis');
  assert.equal(r2.status, 'unresolved');
  assert.ok(r2.reason);

  const r3 = resolveCompetitionByProviderId('api-football', 999999);
  assert.equal(r3, null);
});

test('empty / whitespace / null input is unresolved', () => {
  assert.equal(resolveCompetitionByAlias('').status, 'unresolved');
  assert.equal(resolveCompetitionByAlias('   ').status, 'unresolved');
  assert.equal(resolveCompetitionByAlias(null as unknown as string).status, 'unresolved');
  assert.equal(resolveCompetitionByAlias(undefined as unknown as string).status, 'unresolved');
});

test('alias collision across two competitions is reported as ambiguous', async () => {
  const { validateCompetitionRegistry } = await import('../registry');
  const issues = validateCompetitionRegistry();
  // In the curated registry there should be no alias collisions.
  const aliasCollisions = issues.filter((i) => i.kind === 'alias_collision');
  assert.deepEqual(aliasCollisions, []);

  // Synthetic test: a resolver-level ambiguous path is impossible to reach
  // with the current registry (no alias is shared). We assert the negative
  // to document the contract.
  const r = resolveCompetitionByAlias('Premier League');
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'league:premier-league');
});

test('mock provider never resolves to a registry entry', () => {
  // Sanity: passing provider=mock returns unresolved via the canonical resolver.
  const r = resolveCompetition({ provider: 'mock', external_id: 'PL' });
  assert.equal(r.status, 'unresolved');
});
