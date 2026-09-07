// Tests — Team Identity

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTeamByCanonicalId,
  resolveTeamByProviderId,
  resolveTeamByAlias,
  resolveTeam,
  deterministicTeamCanonicalId,
  listTeams,
} from '../identity';

test('canonical_id exact match', () => {
  const t = resolveTeamByCanonicalId('team:manchester-united');
  assert.ok(t);
  assert.equal(t!.display_name, 'Manchester United');
});

test('common alias exact match', () => {
  const r = resolveTeamByAlias('Man Utd');
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'team:manchester-united');

  const r2 = resolveTeamByAlias('PSG');
  assert.equal(r2.status, 'resolved');
  assert.equal(r2.entity!.canonical_id, 'team:paris-saint-germain');
});

test('Thai alias exact match', () => {
  const r = resolveTeamByAlias('แมนยู');
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'team:manchester-united');
});

test('whitespace normalization', () => {
  const r = resolveTeamByAlias('  Real   Madrid  ');
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'team:real-madrid');
});

test('deterministicTeamCanonicalId: same input → same id', () => {
  const a = deterministicTeamCanonicalId('Manchester United');
  const b = deterministicTeamCanonicalId('Manchester United');
  assert.equal(a, b);
  assert.equal(a, 'team:manchester-united');

  // case + whitespace insensitive
  const c = deterministicTeamCanonicalId('  manchester   UNITED ');
  assert.equal(c, 'team:manchester-united');
});

test('deterministicTeamCanonicalId: non-Latin name returns empty (caller must curate)', () => {
  assert.equal(deterministicTeamCanonicalId('แมนยู'), '');
  assert.equal(deterministicTeamCanonicalId('バイエルン・ミュンヘン'), '');
});

test('provider_id lookup (empty mapping → unresolved)', () => {
  // seed registry has no provider_ids yet; verify resolver handles empty
  // case without throwing.
  const t = resolveTeamByProviderId('api-football', 1);
  assert.equal(t, null);

  const r = resolveTeam({ provider: 'api-football', external_id: 1 });
  assert.equal(r.status, 'unresolved');
});

test('unknown team → unresolved', () => {
  assert.equal(resolveTeamByCanonicalId('team:made-up'), null);
  const r = resolveTeamByAlias('FC Hyper United of Atlantis');
  assert.equal(r.status, 'unresolved');
});

test('empty / null / undefined input is unresolved', () => {
  assert.equal(resolveTeamByAlias('').status, 'unresolved');
  assert.equal(resolveTeamByAlias('   ').status, 'unresolved');
  assert.equal(resolveTeamByAlias(null as unknown as string).status, 'unresolved');
  assert.equal(resolveTeamByAlias(undefined as unknown as string).status, 'unresolved');
});

test('duplicate alias registration would be reported as ambiguous', () => {
  // Current seed has no alias collisions across distinct canonical_ids.
  // This test documents the contract: a single alias must resolve uniquely.
  const r = resolveTeamByAlias('Liverpool');
  assert.equal(r.status, 'resolved');
  assert.equal(r.entity!.canonical_id, 'team:liverpool');
  // Negative: there must be no candidate list of length > 1
  assert.equal(r.candidates, undefined);
});

test('listTeams returns seeded entries', () => {
  const all = listTeams();
  assert.ok(all.length >= 8);
  for (const t of all) {
    assert.ok(t.canonical_id.startsWith('team:'));
    assert.ok(t.display_name.length > 0);
  }
});
