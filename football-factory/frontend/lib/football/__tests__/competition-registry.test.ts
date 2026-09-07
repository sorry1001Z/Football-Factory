// Tests — Competition Registry
// Run with: npm test (uses Node built-in test runner)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITION_REGISTRY,
  listEnabledCompetitions,
  getCompetitionByCanonicalId,
  getCompetitionByProviderId,
  validateCompetitionRegistry,
} from '../registry';

test('registry contains all 14 expected competitions', () => {
  const expected = [
    'league:premier-league',
    'league:laliga',
    'league:bundesliga',
    'league:serie-a',
    'league:ligue-1',
    'competition:uefa-champions-league',
    'competition:uefa-europa-league',
    'competition:uefa-conference-league',
    'cup:fa-cup',
    'cup:carabao-cup',
    'cup:copa-del-rey',
    'cup:dfb-pokal',
    'cup:coppa-italia',
    'cup:coupe-de-france',
  ];
  const ids = COMPETITION_REGISTRY.map((c) => c.canonical_id);
  for (const id of expected) assert.ok(ids.includes(id), `missing ${id}`);
  assert.equal(COMPETITION_REGISTRY.length, 14);
});

test('canonical_ids are unique', () => {
  const issues = validateCompetitionRegistry().filter((i) => i.kind === 'duplicate_canonical_id');
  assert.deepEqual(issues, []);
});

test('provider_ids do not collide per provider', () => {
  const issues = validateCompetitionRegistry().filter((i) => i.kind === 'duplicate_provider_id');
  assert.deepEqual(issues, []);
});

test('priority values are valid non-negative numbers', () => {
  const issues = validateCompetitionRegistry().filter((i) => i.kind === 'invalid_priority');
  assert.deepEqual(issues, []);
  for (const c of COMPETITION_REGISTRY) {
    assert.ok(Number.isFinite(c.priority));
    assert.ok(c.priority >= 0);
  }
});

test('every entry has a non-empty short_name', () => {
  const issues = validateCompetitionRegistry().filter((i) => i.kind === 'missing_short_name');
  assert.deepEqual(issues, []);
});

test('every entry has a non-empty country', () => {
  const issues = validateCompetitionRegistry().filter((i) => i.kind === 'invalid_country');
  assert.deepEqual(issues, []);
});

test('listEnabledCompetitions returns only enabled entries', () => {
  const all = COMPETITION_REGISTRY.length;
  const enabled = listEnabledCompetitions().length;
  assert.ok(enabled > 0);
  assert.ok(enabled <= all);
  for (const c of listEnabledCompetitions()) assert.equal(c.enabled, true);
});

test('getCompetitionByCanonicalId finds known and rejects unknown', () => {
  const found = getCompetitionByCanonicalId('league:premier-league');
  assert.ok(found);
  assert.equal(found!.name, 'Premier League');
  assert.equal(getCompetitionByCanonicalId('league:not-a-real-league'), null);
});

test('getCompetitionByProviderId works for both providers', () => {
  const fd = getCompetitionByProviderId('football-data.org', 'PL');
  assert.ok(fd);
  assert.equal(fd!.canonical_id, 'league:premier-league');

  const af = getCompetitionByProviderId('api-football', 39);
  assert.ok(af);
  assert.equal(af!.canonical_id, 'league:premier-league');

  // unknown
  assert.equal(getCompetitionByProviderId('football-data.org', 'XX'), null);
  assert.equal(getCompetitionByProviderId('api-football', 99999), null);
});
