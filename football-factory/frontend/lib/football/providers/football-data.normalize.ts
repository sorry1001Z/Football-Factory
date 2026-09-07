// Football Factory — football-data.org normalizer.
// Phase 1.B. Pure functions that turn raw football-data.org payloads into
// canonical Football Factory records. No I/O, no env reads.
//
// football-data.org response shape (v4, simplified):
//   { competitions: [{ id, name, code, area: { name, code }, ... }] }
//   { matches:      [{ id, utcDate, status, homeTeam, awayTeam, score, competition, ... }] }
//   { standings:    [{ table: [{ position, team, playedGames, won, draw, lost, goalsFor, goalsAgainst, points, form }], ... }] }
//   { teams:        [{ id, name, shortName, area, crest }] }

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
import type { CompetitionRegistryEntry, TeamRegistryEntry } from '../registry/types';

// ----- tiny type guards ---------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function pickNumber(o: Record<string, unknown>, key: string): number | undefined {
  const v = o[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pickObject(o: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = o[key];
  return isObject(v) ? v : null;
}

const UNRESOLVED_TEAM: TeamRegistryEntry = {
  canonical_id: '',
  display_name: '',
  aliases: [],
  competition_canonical_ids: [],
  provider_ids: {},
  review_required: true,
};

// ----- competition --------------------------------------------------------

export function normalizeFootballDataCompetition(
  raw: unknown,
  fetched_at: string,
): { record: Competition; resolved: boolean } {
  if (!isObject(raw)) {
    return {
      record: emptyCompetition(fetched_at),
      resolved: false,
    };
  }

  const id = pickString(raw, 'id'); // numeric string like "2021/PL"
  const code = pickString(raw, 'code'); // "PL"
  const area = pickObject(raw, 'area');
  const name = pickString(raw, 'name') || code;

  // Try to resolve to a canonical Competition via provider-id mapping.
  const resolved: CompetitionRegistryEntry | null = code
    ? resolveCompetitionByProviderId('football-data.org', code)
    : null;

  const tier: Competition['tier'] = resolved
    ? resolved.competition_type === 'continental'
      ? 'european_cup'
      : resolved.competition_type === 'cup'
        ? 'domestic_cup'
        : 'domestic_league'
    : 'domestic_league';

  return {
    resolved: resolved !== null,
    record: {
      provider: 'football-data.org',
      external_id: id,
      canonical_id: resolved?.canonical_id ?? `comp:fd:${id}`,
      fetched_at,
      data_quality_status: resolved ? 'fresh' : 'partial',
      code: code || id,
      name,
      country: area ? pickString(area, 'name') : '',
      tier,
    },
  };
}

// ----- team ---------------------------------------------------------------

export function normalizeFootballDataTeam(
  raw: unknown,
  fetched_at: string,
  knownTeamLookup: (providerId: string | number) => TeamRegistryEntry | null,
): { record: Team; resolved: boolean } {
  if (!isObject(raw)) {
    return { record: emptyTeam(fetched_at), resolved: false };
  }
  const id = pickString(raw, 'id'); // football-data.org team id is numeric string
  const name = pickString(raw, 'name');
  const shortName = pickString(raw, 'shortName') || pickString(raw, 'tla');
  const area = pickObject(raw, 'area');
  const country = area ? pickString(area, 'name') : '';

  const known = id ? knownTeamLookup(id) : null;
  return {
    resolved: known !== null,
    record: {
      provider: 'football-data.org',
      external_id: id,
      canonical_id: known?.canonical_id ?? `team:fd:${id}`,
      fetched_at,
      data_quality_status: known ? 'fresh' : 'partial',
      name,
      short_name: shortName || undefined,
      country: country || undefined,
      competition_canonical_ids: known ? [...known.competition_canonical_ids] : [],
      crest_url: pickString(raw, 'crest') || undefined,
    },
  };
}

// ----- season -------------------------------------------------------------

export function normalizeFootballDataSeason(
  raw: unknown,
  competition_canonical_id: string,
  fetched_at: string,
): Season | null {
  if (!isObject(raw)) return null;
  const id = pickString(raw, 'id');
  if (!id) return null;
  return {
    provider: 'football-data.org',
    external_id: id,
    canonical_id: `season:fd:${id}`,
    fetched_at,
    data_quality_status: 'fresh',
    competition_canonical_id,
    start_date: pickString(raw, 'startDate'),
    end_date: pickString(raw, 'endDate'),
    current_matchday: pickNumber(raw, 'currentMatchday'),
  };
}

// ----- fixture / match ----------------------------------------------------

export function normalizeFootballDataMatch(
  raw: unknown,
  competition_canonical_id: string,
  season_canonical_id: string,
  fetched_at: string,
  knownTeamLookup: (providerId: string | number) => TeamRegistryEntry | null,
): MatchResult | null {
  if (!isObject(raw)) return null;
  const id = pickString(raw, 'id');
  if (!id) return null;

  const utc_date = pickString(raw, 'utcDate');
  const status = normalizeMatchStatus(raw['status']);

  const homeObj = pickObject(raw, 'homeTeam');
  const awayObj = pickObject(raw, 'awayTeam');
  if (!homeObj || !awayObj) return null;
  const homeId = pickString(homeObj, 'id');
  const awayId = pickString(awayObj, 'id');

  const homeTeam = homeId ? knownTeamLookup(homeId) : null;
  const awayTeam = awayId ? knownTeamLookup(awayId) : null;

  const score = pickObject(raw, 'score');
  const fullTime = score ? pickObject(score, 'fullTime') : null;
  const halfTime = score ? pickObject(score, 'halfTime') : null;

  const homeScore = fullTime?.['home'] as number | undefined;
  const awayScore = fullTime?.['away'] as number | undefined;

  const hasFinalScore = typeof homeScore === 'number' && typeof awayScore === 'number';
  const dataQuality: DataQualityStatus =
    hasFinalScore ? 'fresh' : (status === 'finished' ? 'partial' : 'fresh');

  const winner: MatchResult['winner'] =
    !hasFinalScore ? undefined
    : homeScore > awayScore ? 'home'
    : homeScore < awayScore ? 'away'
    : 'draw';

  return {
    provider: 'football-data.org',
    external_id: id,
    canonical_id: `match:fd:${id}`,
    fetched_at,
    data_quality_status: dataQuality,
    competition_canonical_id,
    season_canonical_id,
    utc_date,
    home_team_canonical_id: homeTeam?.canonical_id ?? `team:fd:${homeId}`,
    away_team_canonical_id: awayTeam?.canonical_id ?? `team:fd:${awayId}`,
    status: status as MatchStatus,
    venue: undefined,
    home_score: homeScore,
    away_score: awayScore,
    half_time_home: (halfTime?.['home'] as number | undefined) ?? undefined,
    half_time_away: (halfTime?.['away'] as number | undefined) ?? undefined,
    winner,
  };
}

// ----- standings ----------------------------------------------------------

export function normalizeFootballDataStandings(
  raw: unknown,
  competition_canonical_id: string,
  season_canonical_id: string,
  fetched_at: string,
  knownTeamLookup: (providerId: string | number) => TeamRegistryEntry | null,
): Standings | null {
  if (!isObject(raw)) return null;
  const standings = (raw['standings'] as unknown[] | undefined) ?? [];
  if (standings.length === 0) return null;

  // football-data.org standings format: { standings: [{ table: [...] }] }
  const firstBlock = standings[0];
  if (!isObject(firstBlock)) return null;
  const tableRaw = (firstBlock['table'] as unknown[] | undefined) ?? [];

  const table: StandingRow[] = [];
  for (const row of tableRaw) {
    if (!isObject(row)) continue;
    const teamObj = pickObject(row, 'team');
    const teamId = teamObj ? pickString(teamObj, 'id') : '';
    const teamKnown = teamId ? knownTeamLookup(teamId) : null;
    const teamCanonical = teamKnown?.canonical_id ?? `team:fd:${teamId}`;

    const played = pickNumber(row, 'playedGames') ?? 0;
    const won = pickNumber(row, 'won') ?? 0;
    const draw = pickNumber(row, 'draw') ?? 0;
    const lost = pickNumber(row, 'lost') ?? 0;
    const goalsFor = pickNumber(row, 'goalsFor') ?? 0;
    const goalsAgainst = pickNumber(row, 'goalsAgainst') ?? 0;
    const points = pickNumber(row, 'points') ?? 0;
    const goalDifference = pickNumber(row, 'goalDifference') ?? (goalsFor - goalsAgainst);
    const formRaw = row['form'];
    const form = typeof formRaw === 'string' ? formRaw : undefined;

    table.push({
      position: pickNumber(row, 'position') ?? 0,
      team_canonical_id: teamCanonical,
      played, won, draw, lost,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      goal_difference: goalDifference,
      points,
      form,
    });
  }

  return {
    provider: 'football-data.org',
    external_id: pickString(raw, 'id') || 'unknown',
    canonical_id: `standings:fd:${competition_canonical_id}:${season_canonical_id}`,
    fetched_at,
    data_quality_status: table.length > 0 ? 'fresh' : 'partial',
    competition_canonical_id,
    season_canonical_id,
    table,
  };
}

// ----- list-shape helpers used by the client -----------------------------

export function pickFootballDataList<T>(
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
    if (item === null || typeof item !== 'object') continue;
    try {
      out.push(normalizer(item, fetched_at));
    } catch {
      // skip malformed item; do not throw the whole batch
    }
  }
  return out;
}

// ----- empty fallbacks (used only for malformed top-level payloads) ------

function emptyCompetition(fetched_at: string): Competition {
  return {
    provider: 'football-data.org',
    external_id: '',
    canonical_id: 'comp:fd:invalid',
    fetched_at,
    data_quality_status: 'unavailable',
    code: '',
    name: '',
    tier: 'domestic_league',
  };
}

function emptyTeam(fetched_at: string): Team {
  return {
    provider: 'football-data.org',
    external_id: '',
    canonical_id: 'team:fd:invalid',
    fetched_at,
    data_quality_status: 'unavailable',
    name: '',
    competition_canonical_ids: [],
  };
}

export { UNRESOLVED_TEAM };
