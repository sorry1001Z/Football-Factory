// Football Factory — canonical domain types.
// Provider-agnostic. Frontend and provider adapters both consume these.
// NEVER leak raw provider payloads here.

export type ProviderName = 'football-data.org' | 'api-football' | 'mock';

export type DataQualityStatus =
  | 'fresh'         // just fetched
  | 'cached'        // served from local cache within TTL
  | 'stale'         // past TTL but better than nothing
  | 'fallback'      // served by secondary or mock
  | 'unavailable';  // provider failed, no data

export interface Provenance {
  provider: ProviderName;
  external_id: string;     // id from the upstream provider payload
  canonical_id: string;    // Football Factory stable id
  fetched_at: string;      // ISO 8601 timestamp
  data_quality_status: DataQualityStatus;
}

export interface Competition extends Provenance {
  code: string;            // e.g. PL, PD, BL1, SA, FL1, CL, EL, ECL, FAC
  name: string;            // e.g. Premier League
  country?: string;        // e.g. England
  tier: 'domestic_league' | 'domestic_cup' | 'european_cup';
  region?: string;
}

export interface Season extends Provenance {
  competition_canonical_id: string;
  start_date: string;      // ISO date
  end_date: string;        // ISO date
  current_matchday?: number;
}

export interface Team extends Provenance {
  name: string;
  short_name?: string;
  country?: string;
  competition_canonical_ids: string[];
  crest_url?: string;
}

export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface Fixture extends Provenance {
  competition_canonical_id: string;
  season_canonical_id: string;
  matchday?: number;
  utc_date: string;        // ISO timestamp
  home_team_canonical_id: string;
  away_team_canonical_id: string;
  status: MatchStatus;
  venue?: string;
}

export interface MatchResult extends Fixture {
  home_score?: number;
  away_score?: number;
  half_time_home?: number;
  half_time_away?: number;
  winner?: 'home' | 'away' | 'draw';
}

export interface StandingRow {
  position: number;
  team_canonical_id: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form?: string;           // e.g. "WWDLW"
}

export interface Standings extends Provenance {
  competition_canonical_id: string;
  season_canonical_id: string;
  table: StandingRow[];
}

export interface QueryParams {
  competition_canonical_id?: string;
  season_canonical_id?: string;
  team_canonical_id?: string;
  matchday?: number;
  from?: string;           // ISO date
  to?: string;             // ISO date
  limit?: number;
}
