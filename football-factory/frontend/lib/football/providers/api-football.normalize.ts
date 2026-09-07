// Football Factory — API-Football normalizer.
// Phase 1.B. Pure functions that turn raw API-Football (api-sports) payloads
// into canonical Football Factory records. No I/O, no env reads.
//
// API-Football (api-sports.io v3) response shape (simplified):
//   {
//     "get": "leagues",
//     "response": [{ league: { id, name, type, country, code }, seasons: [{ year, start, end, current }] }]
//   }
//   { response: [{ fixture: { id, date, status: { short, long }, ... }, league: {...}, teams: { home, away }, goals, score }] }
//   { response: [{ league: {...}, team: {...}, points, rank, goalsDiff, all, home, away }] }

import type {
  Competition,
  DataQualityStatus,
  Fixture,
  MatchResult,
  MatchStatus,
  Season,
  StandingRow,
  Standings,
  Team,
} from '../types';
import { normalizeMatchStatus } from './_shared';
import { resolveCompetitionByProviderId } from '../identity';
import type { CompetitionRegistryEntry } from '../registry/types';

// ----- type guards --------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === 'string' ? v : '';
}

function pickNumber(o: Record<string, unknown>, key: string): number | undefined {
  const v = o[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pickObject(o: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = o[key];
  return isObject(v) ? v : null;
}

// ----- competition --------------------------------------------------------

export function normalizeApiFootballCompetition(
  raw: unknown,
  fetched_at: string,
): { record: Competition; resolved: boolean } {
  if (!isObject(raw)) {
    return {
      record: emptyCompetition(fetched_at),
      resolved: false,
    };
  }

  const leagueObj = pickObject(raw, 'league');
  if (!leagueObj) {
    return { record: emptyCompetition(fetched_at), resolved: false };
  }
  const id = pickNumber(leagueObj, 'id')?.toString() ?? '';
  const name = pickString(leagueObj, 'name');
  const countryObj = pickObject(raw, 'country');
  const country = countryObj ? pickString(countryObj, 'name') : pickString(raw, 'country');

  const resolved: CompetitionRegistryEntry | null = id
    ? resolveCompetitionByProviderId('api-football', id)
    : null;

  return {
    resolved: resolved !== null,
    record: {
      provider: 'api-football',
      external_id: id,
      canonical_id: resolved?.canonical_id ?? `comp:af:${id}`,
      fetched_at,
      data_quality_status: resolved ? 'fresh' : 'partial',
      code: resolved?.short_name ?? '',
      name,
      country,
      tier: resolved
        ? resolved.competition_type === 'continental'
          ? 'european_cup'
          : resolved.competition_type === 'cup'
            ? 'domestic_cup'
            : 'domestic_league'
        : 'domestic_league',
    },
  };
}

// ----- team ---------------------------------------------------------------

export function normalizeApiFootballTeam(
  raw: unknown,
  fetched_at: string,
): { record: Team; resolved: boolean } {
  if (!isObject(raw)) return { record: emptyTeam(fetched_at), resolved: false };

  const teamObj = pickObject(raw, 'team');
  const idRaw = teamObj ? pickNumber(teamObj, 'id') : pickNumber(raw, 'id');
  const id = idRaw?.toString() ?? '';
  const name = teamObj ? pickString(teamObj, 'name') : pickString(raw, 'name');
  const countryRaw = pickString(raw, 'country');
  const country = countryRaw || (teamObj ? pickString(teamObj, 'country') : '');

  // API-Football team provider_ids are not yet in the team registry; resolve
  // deterministically as `team:af:<id>` and mark partial.
  return {
    resolved: false,
    record: {
      provider: 'api-football',
      external_id: id,
      canonical_id: `team:af:${id}`,
      fetched_at,
      data_quality_status: 'partial',
      name,
      country: country || undefined,
      competition_canonical_ids: [],
    },
  };
}

// ----- season -------------------------------------------------------------

export function normalizeApiFootballSeason(
  raw: unknown,
  competition_canonical_id: string,
  fetched_at: string,
): Season | null {
  if (!isObject(raw)) return null;
  const year = pickNumber(raw, 'year');
  if (year === undefined) return null;
  return {
    provider: 'api-football',
    external_id: year.toString(),
    canonical_id: `season:af:${competition_canonical_id}:${year}`,
    fetched_at,
    data_quality_status: 'fresh',
    competition_canonical_id,
    start_date: pickString(raw, 'start'),
    end_date: pickString(raw, 'end'),
    current_matchday: undefined,
  };
}

// ----- fixture / match ----------------------------------------------------

export function normalizeApiFootballMatch(
  raw: unknown,
  fetched_at: string,
): MatchResult | null {
  if (!isObject(raw)) return null;
  const fixtureObj = pickObject(raw, 'fixture');
  if (!fixtureObj) return null;

  const id = pickNumber(fixtureObj, 'id')?.toString() ?? '';
  if (!id) return null;

  const statusObj = pickObject(fixtureObj, 'status');
  const status: MatchStatus = statusObj
    ? normalizeMatchStatus(statusObj['short'] ?? statusObj['long'])
    : 'unknown';

  const date = pickString(fixtureObj, 'date');

  const teamsObj = pickObject(raw, 'teams');
  const homeObj = teamsObj ? pickObject(teamsObj, 'home') : null;
  const awayObj = teamsObj ? pickObject(teamsObj, 'away') : null;
  const homeId = homeObj ? pickNumber(homeObj, 'id')?.toString() : '';
  const awayId = awayObj ? pickNumber(awayObj, 'id')?.toString() : '';

  const goalsObj = pickObject(raw, 'goals');
  const homeScore = goalsObj ? pickNumber(goalsObj, 'home') : undefined;
  const awayScore = goalsObj ? pickNumber(goalsObj, 'away') : undefined;

  const hasFinalScore = typeof homeScore === 'number' && typeof awayScore === 'number';

  const dataQuality: DataQualityStatus =
    hasFinalScore ? 'fresh' : (status === 'finished' ? 'partial' : 'fresh');

  const winner: MatchResult['winner'] =
    !hasFinalScore ? undefined
    : homeScore > awayScore ? 'home'
    : homeScore < awayScore ? 'away'
    : 'draw';

  return {
    provider: 'api-football',
    external_id: id,
    canonical_id: `match:af:${id}`,
    fetched_at,
    data_quality_status: dataQuality,
    competition_canonical_id: '', // caller supplies canonical_id from league context
    season_canonical_id: '',
    utc_date: date,
    home_team_canonical_id: homeId ? `team:af:${homeId}` : '',
    away_team_canonical_id: awayId ? `team:af:${awayId}` : '',
    status,
    venue: undefined,
    home_score: homeScore,
    away_score: awayScore,
    half_time_home: undefined,
    half_time_away: undefined,
    winner,
  };
}

// ----- standings ----------------------------------------------------------

export function normalizeApiFootballStandings(
  rawArr: unknown,
  competition_canonical_id: string,
  fetched_at: string,
): Standings[] {
  if (!Array.isArray(rawArr)) return [];

  // API-Football (api-sports) standings: response is an array of league blocks;
  // each block has league.{id,name,season} and standings: [[rows...], ...]
  // (the inner array is an array of "tables" — usually one for each group).
  const all: StandingRow[] = [];
  for (const block of rawArr) {
    if (!isObject(block)) continue;
    const leagueObj = pickObject(block, 'league');
    const cid = leagueObj ? pickNumber(leagueObj, 'id')?.toString() : '';
    if (!cid) continue;
    const standings = block['standings'];
    if (!Array.isArray(standings)) continue;
    for (const groupTable of standings) {
      if (!Array.isArray(groupTable)) continue;
      for (const row of groupTable) {
        if (!isObject(row)) continue;
        const teamObj = pickObject(row, 'team');
        const teamId = teamObj ? pickNumber(teamObj, 'id')?.toString() ?? '' : '';
        all.push({
          position: pickNumber(row, 'rank') ?? 0,
          team_canonical_id: teamId ? `team:af:${teamId}` : '',
          played: pickNumber(row, 'played') ?? 0,
          won: pickNumber(row, 'win') ?? 0,
          draw: pickNumber(row, 'draw') ?? 0,
          lost: pickNumber(row, 'lose') ?? 0,
          goals_for: pickNumber(row, 'goalsFor') ?? 0,
          goals_against: pickNumber(row, 'goalsAgainst') ?? 0,
          goal_difference: pickNumber(row, 'goalsDiff') ?? 0,
          points: pickNumber(row, 'points') ?? 0,
          form: pickString(row, 'form'),
        });
      }
    }
  }

  if (all.length === 0) return [];
  return [{
    provider: 'api-football',
    external_id: 'unknown',
    canonical_id: `standings:af:${competition_canonical_id}`,
    fetched_at,
    data_quality_status: 'fresh',
    competition_canonical_id,
    season_canonical_id: '',
    table: all,
  }];
}

// ----- list helper --------------------------------------------------------

export function pickApiFootballList<T>(
  raw: unknown,
  itemKey: string,
  normalizer: (item: unknown, fetched_at: string) => T,
  fetched_at: string,
): T[] {
  if (!isObject(raw)) return [];
  const list = raw[itemKey];
  if (!Array.isArray(list)) return [];
  const out: T[] = [];
  for (const item of list) {
    // skip null / non-object items so callers do not have to defensively check
    if (item === null || typeof item !== 'object') continue;
    try {
      out.push(normalizer(item, fetched_at));
    } catch {
      // skip malformed item; do not throw the whole batch
    }
  }
  return out;
}

// ----- empty fallbacks ----------------------------------------------------

function emptyCompetition(fetched_at: string): Competition {
  return {
    provider: 'api-football',
    external_id: '',
    canonical_id: 'comp:af:invalid',
    fetched_at,
    data_quality_status: 'unavailable',
    code: '',
    name: '',
    tier: 'domestic_league',
  };
}

function emptyTeam(fetched_at: string): Team {
  return {
    provider: 'api-football',
    external_id: '',
    canonical_id: 'team:af:invalid',
    fetched_at,
    data_quality_status: 'unavailable',
    name: '',
    competition_canonical_ids: [],
  };
}
