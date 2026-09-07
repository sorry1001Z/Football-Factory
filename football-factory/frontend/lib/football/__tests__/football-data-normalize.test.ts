// Tests — football-data.org normalizer + status mapping + error model.
// Phase 1.B. No real network. Uses sanitized fixtures only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFootballDataCompetition,
  normalizeFootballDataMatch,
  normalizeFootballDataStandings,
  normalizeFootballDataTeam,
  pickFootballDataList,
} from '../providers/football-data.normalize';
import { normalizeMatchStatus, ProviderError, fetchJson } from '../providers/_shared';
import { FootballDataClient, FootballDataProvider } from '../providers/football-data.client';
import {
  FD_COMPETITIONS_LIST,
  FD_MATCHES_LIST,
  FD_STANDINGS,
  FD_TEAMS_LIST,
  FD_MALFORMED,
  FD_UNKNOWN_COMPETITION,
  FD_INVALID_PAYLOAD,
} from '../providers/__fixtures__/football-data.fixtures';

const FETCHED_AT = '2025-02-01T12:00:00.000Z';

// ---- status mapping -----------------------------------------------------

test('normalizeMatchStatus: all canonical values mapped', () => {
  assert.equal(normalizeMatchStatus('SCHEDULED'), 'scheduled');
  assert.equal(normalizeMatchStatus('TIMED'), 'scheduled');
  assert.equal(normalizeMatchStatus('IN_PLAY'), 'live');
  assert.equal(normalizeMatchStatus('LIVE'), 'live');
  assert.equal(normalizeMatchStatus('1H'), 'live');
  assert.equal(normalizeMatchStatus('HT'), 'live');
  assert.equal(normalizeMatchStatus('ET'), 'live');
  assert.equal(normalizeMatchStatus('PAUSED'), 'live');
  assert.equal(normalizeMatchStatus('FINISHED'), 'finished');
  assert.equal(normalizeMatchStatus('FT'), 'finished');
  assert.equal(normalizeMatchStatus('AET'), 'finished');
  assert.equal(normalizeMatchStatus('PEN'), 'finished');
  assert.equal(normalizeMatchStatus('AWARDED'), 'finished');
  assert.equal(normalizeMatchStatus('POSTPONED'), 'postponed');
  assert.equal(normalizeMatchStatus('CANCELLED'), 'cancelled');
  assert.equal(normalizeMatchStatus('ABANDONED'), 'cancelled');
  // unknown values
  assert.equal(normalizeMatchStatus('WHATEVER_NEW_STATE'), 'unknown');
  assert.equal(normalizeMatchStatus(undefined), 'unknown');
  assert.equal(normalizeMatchStatus(null), 'unknown');
  assert.equal(normalizeMatchStatus(''), 'unknown');
  assert.equal(normalizeMatchStatus(12345), 'unknown');
});

// ---- competitions normalization -----------------------------------------

test('football-data: competition resolves via provider id (PL)', () => {
  const pl = FD_COMPETITIONS_LIST.competitions[0];
  const { record, resolved } = normalizeFootballDataCompetition(pl, FETCHED_AT);
  assert.equal(resolved, true);
  assert.equal(record.provider, 'football-data.org');
  assert.equal(record.canonical_id, 'league:premier-league');
  assert.equal(record.code, 'PL');
  assert.equal(record.name, 'Premier League');
  assert.equal(record.country, 'England');
  assert.equal(record.tier, 'domestic_league');
  assert.equal(record.data_quality_status, 'fresh');
});

test('football-data: competition with unknown code → partial, provisional id', () => {
  const unk = FD_UNKNOWN_COMPETITION.competitions[0];
  const { record, resolved } = normalizeFootballDataCompetition(unk, FETCHED_AT);
  assert.equal(resolved, false);
  assert.equal(record.canonical_id, 'comp:fd:9999');
  assert.equal(record.data_quality_status, 'partial');
});

test('football-data: malformed top-level competition object', () => {
  const { record, resolved } = normalizeFootballDataCompetition(null, FETCHED_AT);
  assert.equal(resolved, false);
  assert.equal(record.canonical_id, 'comp:fd:invalid');
  assert.equal(record.data_quality_status, 'unavailable');
});

// ---- matches normalization ---------------------------------------------

test('football-data: finished match has scores and winner=home', () => {
  const finished = FD_MATCHES_LIST.matches[0];
  const m = normalizeFootballDataMatch(finished, 'league:premier-league', 'season:fd:1', FETCHED_AT, () => null);
  assert.ok(m);
  assert.equal(m!.status, 'finished');
  assert.equal(m!.home_score, 2);
  assert.equal(m!.away_score, 1);
  assert.equal(m!.winner, 'home');
  assert.equal(m!.data_quality_status, 'fresh');
  assert.equal(m!.home_team_canonical_id, 'team:fd:66');
  assert.equal(m!.away_team_canonical_id, 'team:fd:73');
});

test('football-data: timed (scheduled) match has no scores, status=scheduled', () => {
  const timed = FD_MATCHES_LIST.matches[1];
  const m = normalizeFootballDataMatch(timed, 'league:premier-league', '', FETCHED_AT, () => null);
  assert.ok(m);
  assert.equal(m!.status, 'scheduled');
  assert.equal(m!.home_score, undefined);
  assert.equal(m!.away_score, undefined);
  assert.equal(m!.winner, undefined);
});

test('football-data: unknown status string maps to canonical unknown', () => {
  const weird = FD_MATCHES_LIST.matches[2];
  const m = normalizeFootballDataMatch(weird, 'league:premier-league', '', FETCHED_AT, () => null);
  assert.ok(m);
  assert.equal(m!.status, 'unknown');
});

test('football-data: match with team lookup returns canonical team id', () => {
  const finished = FD_MATCHES_LIST.matches[0];
  const lookup = (id: string | number) => (id === '66' || id === 66
    ? { canonical_id: 'team:manchester-united', display_name: 'Manchester United', aliases: [], competition_canonical_ids: [], provider_ids: {} }
    : null);
  const m = normalizeFootballDataMatch(finished, 'league:premier-league', '', FETCHED_AT, lookup);
  assert.ok(m);
  assert.equal(m!.home_team_canonical_id, 'team:manchester-united');
});

test('football-data: malformed match returns null', () => {
  const m = normalizeFootballDataMatch({ id: 1 }, '', '', FETCHED_AT, () => null);
  assert.equal(m, null);
});

// ---- standings ----------------------------------------------------------

test('football-data: standings normalize with table rows', () => {
  const s = normalizeFootballDataStandings(FD_STANDINGS, 'league:premier-league', 'season:fd:1', FETCHED_AT, () => null);
  assert.ok(s);
  assert.equal(s!.table.length, 2);
  assert.equal(s!.table[0].points, 71);
  assert.equal(s!.table[0].position, 1);
  assert.equal(s!.data_quality_status, 'fresh');
});

test('football-data: empty standings → null', () => {
  const s = normalizeFootballDataStandings({ standings: [] }, 'c', 's', FETCHED_AT, () => null);
  assert.equal(s, null);
});

// ---- teams --------------------------------------------------------------

test('football-data: team normalization produces provisional id when unknown', () => {
  const t = FD_TEAMS_LIST.teams[0];
  const { record, resolved } = normalizeFootballDataTeam(t, FETCHED_AT, () => null);
  assert.equal(resolved, false);
  assert.equal(record.canonical_id, 'team:fd:66');
  assert.equal(record.name, 'Manchester United');
  assert.equal(record.short_name, 'Man United');
  assert.equal(record.data_quality_status, 'partial');
});

// ---- list-shape helper --------------------------------------------------

test('football-data: pickFootballDataList skips malformed items', () => {
  const raw = { matches: [
    FD_MATCHES_LIST.matches[0],
    { id: 1 }, // missing home/away → normalizer returns null → skipped by try/catch
    FD_MATCHES_LIST.matches[1],
  ] };
  const list = pickFootballDataList(raw, 'matches', (item, fa) => {
    return normalizeFootballDataMatch(item, '', '', fa, () => null);
  }, FETCHED_AT).filter((m): m is NonNullable<typeof m> => m !== null);
  assert.equal(list.length, 2);
});

// ---- error model --------------------------------------------------------

test('ProviderError: structured fields; safe_message never includes header', async () => {
  // fake fetch that returns 401
  const fakeFetch: typeof fetch = async () =>
    new Response('{"message":"Unauthorized"}', { status: 401 }) as Response;
  await assert.rejects(
    async () => fetchJson('football-data.org', 'https://example.test/v4/competitions', { 'X-Auth-Token': 'PLACEHOLDER-SECRET' }, { fetchImpl: fakeFetch }),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.equal((err as ProviderError).kind, 'AUTH_ERROR');
      assert.equal((err as ProviderError).http_status, 401);
      // The safe_message must NOT include the secret value.
      assert.equal((err as ProviderError).safe_message.includes('PLACEHOLDER-SECRET'), false);
      return true;
    },
  );
});

test('ProviderError: 429 → RATE_LIMIT, 404 → NOT_FOUND, 500 → HTTP_ERROR', async () => {
  async function check(status: number, expectedKind: string) {
    const fakeFetch: typeof fetch = async () =>
      new Response('{}', { status }) as Response;
    await assert.rejects(
      async () => fetchJson('football-data.org', 'https://example.test/v4/x', {}, { fetchImpl: fakeFetch }),
      (err: unknown) => {
        assert.equal((err as ProviderError).kind, expectedKind);
        return true;
      },
    );
  }
  await check(429, 'RATE_LIMIT');
  await check(404, 'NOT_FOUND');
  await check(500, 'HTTP_ERROR');
});

test('ProviderError: invalid JSON body → INVALID_PAYLOAD', async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } }) as Response;
  await assert.rejects(
    async () => fetchJson('football-data.org', 'https://example.test/v4/x', {}, { fetchImpl: fakeFetch }),
    (err: unknown) => {
      assert.equal((err as ProviderError).kind, 'INVALID_PAYLOAD');
      return true;
    },
  );
});

test('ProviderError: malformed list payload returns empty, not throw', () => {
  const list = pickFootballDataList(FD_MALFORMED, 'competitions', () => {
    throw new Error('should not be called');
  }, FETCHED_AT);
  assert.deepEqual(list, []);
});

// ---- provider class surface --------------------------------------------

test('FootballDataClient: not configured without key', () => {
  delete process.env.FOOTBALL_DATA_API_KEY;
  const c = new FootballDataClient(undefined);
  assert.equal(c.configured, false);
});

test('FootballDataClient: configured rejects placeholder key', () => {
  const c = new FootballDataClient('replace-with-a-long-random-secret');
  assert.equal(c.configured, false);
});

test('FootballDataClient: configured with a real-shape key', () => {
  const c = new FootballDataClient('abc123-real-key');
  assert.equal(c.configured, true);
});

test('FootballDataProvider: configured reflects env', () => {
  process.env.FOOTBALL_DATA_API_KEY = 'abc-real';
  const p = new FootballDataProvider();
  assert.equal(p.configured, true);
  delete process.env.FOOTBALL_DATA_API_KEY;
});

test('FootballDataProvider: not configured → returns [] (no network)', async () => {
  delete process.env.FOOTBALL_DATA_API_KEY;
  const p = new FootballDataProvider();
  assert.deepEqual(await p.getCompetitions(), []);
  assert.deepEqual(await p.getFixtures(), []);
  assert.deepEqual(await p.getResults(), []);
  assert.deepEqual(await p.getStandings(), []);
  assert.deepEqual(await p.getTeams(), []);
});

test('FootballDataProvider: never logs or echoes key', () => {
  const origKey = process.env.FOOTBALL_DATA_API_KEY;
  process.env.FOOTBALL_DATA_API_KEY = 'SECRET-DO-NOT-ECHO-XYZ';
  try {
    const p = new FootballDataProvider();
    const c = new FootballDataClient(p['client']['apiKey']);
    // Inspect the stringification of the client — the key must not appear
    // anywhere by accident.
    const s = JSON.stringify({ provider: c, err: new ProviderError('AUTH_ERROR', 'football-data.org', 'sample') });
    assert.equal(s.includes('SECRET-DO-NOT-ECHO-XYZ'), false, 'API key leaked into JSON stringification');
  } finally {
    if (origKey === undefined) delete process.env.FOOTBALL_DATA_API_KEY;
    else process.env.FOOTBALL_DATA_API_KEY = origKey;
  }
});
