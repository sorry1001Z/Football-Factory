// Tests — API-Football (api-sports) normalizer + status mapping + error model.
// Phase 1.B. No real network. Uses sanitized fixtures only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeApiFootballCompetition,
  normalizeApiFootballMatch,
  normalizeApiFootballStandings,
  normalizeApiFootballTeam,
  pickApiFootballList,
} from '../providers/api-football.normalize';
import { ApiFootballClient, ApiFootballProvider } from '../providers/api-football.client';
import {
  AF_LEAGUES_LIST,
  AF_FIXTURES_LIST,
  AF_STANDINGS,
  AF_TEAMS_LIST,
  AF_MALFORMED,
  AF_UNKNOWN_COMPETITION,
} from '../providers/__fixtures__/api-football.fixtures';

const FETCHED_AT = '2025-02-01T12:00:00.000Z';

// ---- competitions -------------------------------------------------------

test('api-football: competition resolves via numeric provider id (PL=39)', () => {
  const pl = AF_LEAGUES_LIST.response[0];
  const { record, resolved } = normalizeApiFootballCompetition(pl, FETCHED_AT);
  assert.equal(resolved, true);
  assert.equal(record.provider, 'api-football');
  assert.equal(record.canonical_id, 'league:premier-league');
  assert.equal(record.name, 'Premier League');
  assert.equal(record.country, 'England');
  assert.equal(record.data_quality_status, 'fresh');
});

test('api-football: competition with unknown league id → partial, provisional id', () => {
  const unk = AF_UNKNOWN_COMPETITION.response[0];
  const { record, resolved } = normalizeApiFootballCompetition(unk, FETCHED_AT);
  assert.equal(resolved, false);
  assert.equal(record.canonical_id, 'comp:af:99999');
  assert.equal(record.data_quality_status, 'partial');
});

test('api-football: malformed competition object → empty fallback', () => {
  const { record, resolved } = normalizeApiFootballCompetition(null, FETCHED_AT);
  assert.equal(resolved, false);
  assert.equal(record.canonical_id, 'comp:af:invalid');
});

// ---- matches ------------------------------------------------------------

test('api-football: finished match has scores and winner', () => {
  const finished = AF_FIXTURES_LIST.response[0];
  const m = normalizeApiFootballMatch(finished, FETCHED_AT);
  assert.ok(m);
  assert.equal(m!.status, 'finished');
  assert.equal(m!.home_score, 2);
  assert.equal(m!.away_score, 1);
  assert.equal(m!.winner, 'home');
  assert.equal(m!.data_quality_status, 'fresh');
});

test('api-football: not-started (NS) match has no scores, status=scheduled', () => {
  const ns = AF_FIXTURES_LIST.response[1];
  const m = normalizeApiFootballMatch(ns, FETCHED_AT);
  assert.ok(m);
  assert.equal(m!.status, 'scheduled');
  assert.equal(m!.home_score, undefined);
  assert.equal(m!.away_score, undefined);
});

test('api-football: status short codes mapped', () => {
  // Build a synthetic fixture with various short codes
  const base = AF_FIXTURES_LIST.response[0];
  for (const [short, expected] of [
    ['1H', 'live'],
    ['2H', 'live'],
    ['HT', 'live'],
    ['ET', 'live'],
    ['P', 'live'],
    ['BT', 'live'],
    ['SUSP', 'live'],
    ['INT', 'live'],
    ['AET', 'finished'],
    ['PEN', 'finished'],
    ['FT', 'finished'],
    ['PST', 'postponed'],
    ['CANC', 'cancelled'],
    ['ABD', 'cancelled'],
    ['WO', 'cancelled'],
    ['TBD', 'unknown'],
  ] as const) {
    const item = JSON.parse(JSON.stringify(base));
    item.fixture.status.short = short;
    const m = normalizeApiFootballMatch(item, FETCHED_AT);
    assert.ok(m, `match should normalize for short=${short}`);
    assert.equal(m!.status, expected, `short=${short}`);
  }
});

test('api-football: malformed match returns null', () => {
  const m = normalizeApiFootballMatch({ fixture: { id: 'x' } }, FETCHED_AT);
  assert.equal(m, null);
});

// ---- standings ----------------------------------------------------------

test('api-football: standings table rows normalized', () => {
  const s = normalizeApiFootballStandings(AF_STANDINGS.response, 'league:premier-league', FETCHED_AT);
  assert.equal(s.length, 1);
  const table = s[0].table;
  assert.equal(table.length, 2);
  assert.equal(table[0].position, 1);
  assert.equal(table[0].points, 71);
  assert.equal(table[0].team_canonical_id, 'team:af:65');
});

// ---- teams --------------------------------------------------------------

test('api-football: team normalization → provisional id, partial quality', () => {
  const t = AF_TEAMS_LIST.response[0];
  const { record, resolved } = normalizeApiFootballTeam(t, FETCHED_AT);
  assert.equal(resolved, false);
  assert.equal(record.canonical_id, 'team:af:66');
  assert.equal(record.data_quality_status, 'partial');
});

// ---- list helper --------------------------------------------------------

test('api-football: pickApiFootballList handles non-array response', () => {
  const list = pickApiFootballList(AF_MALFORMED, 'response', () => {
    throw new Error('should not be called');
  }, FETCHED_AT);
  assert.deepEqual(list, []);
});

test('api-football: pickApiFootballList skips throwing normalizers', () => {
  const raw = { response: [AF_LEAGUES_LIST.response[0], null, AF_LEAGUES_LIST.response[1]] };
  const list = pickApiFootballList(raw, 'response', (item) => {
    return normalizeApiFootballCompetition(item, FETCHED_AT).record;
  }, FETCHED_AT);
  assert.equal(list.length, 2);
});

// ---- provider class surface --------------------------------------------

test('ApiFootballClient: configured reflects key presence', () => {
  const c1 = new ApiFootballClient(undefined);
  assert.equal(c1.configured, false);
  const c2 = new ApiFootballClient('replace-with-a-long-random-secret');
  assert.equal(c2.configured, false);
  const c3 = new ApiFootballClient('real-shape-key');
  assert.equal(c3.configured, true);
});

test('ApiFootballProvider: not configured → returns []', async () => {
  delete process.env.API_FOOTBALL_KEY;
  const p = new ApiFootballProvider();
  assert.deepEqual(await p.getCompetitions(), []);
  assert.deepEqual(await p.getFixtures(), []);
  assert.deepEqual(await p.getResults(), []);
  assert.deepEqual(await p.getStandings(), []);
  assert.deepEqual(await p.getTeams(), []);
});

test('ApiFootballProvider: never logs or echoes key', () => {
  const origKey = process.env.API_FOOTBALL_KEY;
  process.env.API_FOOTBALL_KEY = 'SECRET-API-FOOTBALL-DO-NOT-ECHO';
  try {
    const p = new ApiFootballProvider();
    const s = JSON.stringify({ provider: p });
    assert.equal(s.includes('SECRET-API-FOOTBALL-DO-NOT-ECHO'), false, 'API key leaked');
  } finally {
    if (origKey === undefined) delete process.env.API_FOOTBALL_KEY;
    else process.env.API_FOOTBALL_KEY = origKey;
  }
});

// ---- canonical schema: no raw provider shape escapes -------------------

test('canonical records never expose raw provider shape', async () => {
  const record = normalizeApiFootballCompetition(AF_LEAGUES_LIST.response[0], FETCHED_AT).record;
  const serialized = JSON.stringify(record);
  // raw keys like 'league', 'country', 'seasons' must NOT appear in the canonical record
  for (const leak of ['"league":', '"country":{', '"seasons":']) {
    assert.equal(serialized.includes(leak), false, `canonical record leaked raw key: ${leak}`);
  }
});

test('canonical records preserve provenance + fetched_at + data_quality_status', async () => {
  const record = normalizeApiFootballMatch(AF_FIXTURES_LIST.response[0], FETCHED_AT)!;
  assert.equal(record.provider, 'api-football');
  assert.equal(record.fetched_at, FETCHED_AT);
  assert.ok(['fresh', 'partial', 'unverified', 'unavailable', 'error', 'stale', 'cached', 'fallback'].includes(record.data_quality_status));
});
