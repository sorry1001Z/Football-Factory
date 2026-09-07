// Football Factory — football-data.org client.
// Phase 1.B: thin wrapper around fetchJson + normalizer. The class methods
// compose these. NO network calls without FOOTBALL_DATA_API_KEY present.

import type {
  Competition,
  DataQualityStatus,
  Fixture,
  MatchResult,
  QueryParams,
  ProviderName,
  Season,
  Standings,
  Team,
} from '../types';
import { BaseStubProvider } from '../provider';
import { ProviderError, fetchJson } from './_shared';
import {
  normalizeFootballDataCompetition,
  normalizeFootballDataTeam,
  normalizeFootballDataSeason,
  normalizeFootballDataMatch,
  normalizeFootballDataStandings,
  pickFootballDataList,
} from './football-data.normalize';

const PROVIDER: ProviderName = 'football-data.org';

// football-data.org team ids are stable numeric strings; in this Phase 1.B
// client we look them up against the registry only when explicitly mapped.
// For unknown teams the normalizer falls back to a `team:fd:<id>` provisional
// canonical_id and marks data_quality_status=partial.
const KNOWN_TEAM_LOOKUP = (providerId: string | number): null => {
  // TODO Phase 1.D: populate from a real team registry sync.
  // Until then, all team ids return null → unresolved provisional canonical_id.
  void providerId;
  return null;
};

interface FootballDataProviderOptions {
  base_url?: string;
  fetchImpl?: typeof fetch;
}

export class FootballDataClient {
  readonly base_url: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string | undefined, options: FootballDataProviderOptions = {}) {
    this.apiKey = apiKey;
    this.base_url = options.base_url ?? 'https://api.football-data.org/v4';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Override JSON serialization to NEVER expose the API key. */
  toJSON(): unknown {
    return { provider: 'football-data.org', base_url: this.base_url, configured: this.configured };
  }

  get configured(): boolean {
    return Boolean(this.apiKey) && this.apiKey !== 'replace-with-a-long-random-secret';
  }

  /**
   * Build the auth header. The key value lives ONLY in the returned object
   * and is consumed by the same call frame's fetch invocation. It is never
   * assigned to a longer-lived variable here.
   */
  private authHeader(): Record<string, string> {
    if (!this.configured) {
      throw new ProviderError('CONFIG_ERROR', PROVIDER, 'FOOTBALL_DATA_API_KEY not configured');
    }
    return { 'X-Auth-Token': this.apiKey as string };
  }

  private async getJson(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    return fetchJson(PROVIDER, `${this.base_url}${path}`, this.authHeader(), {
      query,
      timeout_ms: 10_000,
    });
  }

  // Test-only helper: run a fake fetch through the same error normalization
  // pipeline so tests can inject 401/404/429/500 without a real network.
  async _testFetchJson(path: string, fetchImpl: typeof fetch, query?: Record<string, string | number | undefined>): Promise<unknown> {
    const url = `${this.base_url}${path}`;
    const fullUrl = query ? url + '?' + new URLSearchParams(query as Record<string, string>).toString() : url;
    const response = await fetchImpl(fullUrl, { method: 'GET', headers: this.authHeader() });
    return fetchJson(PROVIDER, fullUrl, {}, { fetchImpl: async () => response });
  }

  async fetchCompetitions(): Promise<Competition[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson('/competitions');
    return pickFootballDataList<Competition>(
      raw,
      'competitions',
      (item) => {
        const { record } = normalizeFootballDataCompetition(item, fetched_at);
        return record;
      },
      fetched_at,
    );
  }

  async fetchTeams(competitionCode?: string): Promise<Team[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson(
      competitionCode ? `/competitions/${encodeURIComponent(competitionCode)}/teams` : '/teams',
    );
    return pickFootballDataList<Team>(
      raw,
      'teams',
      (item) => {
        const { record } = normalizeFootballDataTeam(item, fetched_at, KNOWN_TEAM_LOOKUP);
        return record;
      },
      fetched_at,
    );
  }

  async fetchSeasons(competitionCode: string): Promise<Season[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson(`/competitions/${encodeURIComponent(competitionCode)}`);
    if (!raw || typeof raw !== 'object') return [];
    // football-data.org returns the competition object with embedded seasons[]
    const seasons = (raw as Record<string, unknown>)['seasons'];
    if (!Array.isArray(seasons)) return [];
    return seasons
      .map((s) => normalizeFootballDataSeason(s, '', fetched_at))
      .filter((s): s is Season => s !== null);
  }

  async fetchMatches(
    competitionCode: string,
    seasonYear: number,
    options: { status?: 'SCHEDULED' | 'FINISHED' | 'LIVE' | 'IN_PLAY' } = {},
  ): Promise<MatchResult[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson(
      `/competitions/${encodeURIComponent(competitionCode)}/matches`,
      { season: seasonYear, status: options.status },
    );
    const matches = (pickFootballDataList<MatchResult | null>(
      raw,
      'matches',
      (item) => {
        return normalizeFootballDataMatch(
          item,
          '',
          '',
          fetched_at,
          KNOWN_TEAM_LOOKUP,
        );
      },
      fetched_at,
    )).filter((m): m is MatchResult => m !== null);

    return matches;
  }

  async fetchStandings(competitionCode: string, seasonYear?: number): Promise<Standings[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson(
      `/competitions/${encodeURIComponent(competitionCode)}/standings`,
      seasonYear !== undefined ? { season: seasonYear } : undefined,
    );
    const normalized = normalizeFootballDataStandings(
      raw,
      '',
      '',
      fetched_at,
      KNOWN_TEAM_LOOKUP,
    );
    return normalized ? [normalized] : [];
  }

  // Test/Phase 1.C helper: allow injecting a fake response shape.
  async parseMatch(raw: unknown, fetched_at: string): Promise<MatchResult | null> {
    return normalizeFootballDataMatch(raw, '', '', fetched_at, KNOWN_TEAM_LOOKUP);
  }

  async parseCompetition(raw: unknown, fetched_at: string): Promise<Competition> {
    return normalizeFootballDataCompetition(raw, fetched_at).record;
  }

  async parseTeam(raw: unknown, fetched_at: string): Promise<Team> {
    return normalizeFootballDataTeam(raw, fetched_at, KNOWN_TEAM_LOOKUP).record;
  }

  async parseStandings(raw: unknown, fetched_at: string): Promise<Standings | null> {
    return normalizeFootballDataStandings(raw, '', '', fetched_at, KNOWN_TEAM_LOOKUP);
  }
}

/**
 * Provider class that the public FootballProvider interface consumes.
 * In Phase 1.B the implementation delegates to FootballDataClient. When the
 * key is absent, all methods return [] and surface a CONFIG_ERROR via health().
 */
export class FootballDataProvider extends BaseStubProvider {
  readonly name: ProviderName = 'football-data.org';
  private readonly client: FootballDataClient;

  constructor(apiKey: string | undefined = process.env.FOOTBALL_DATA_API_KEY) {
    super();
    this.client = new FootballDataClient(apiKey);
  }

  get configured(): boolean {
    return this.client.configured;
  }

  /** Override JSON serialization to NEVER expose the API key. */
  toJSON(): unknown {
    return { provider: this.name, configured: this.configured };
  }

  async getCompetitions(): Promise<Competition[]> {
    if (!this.configured) return [];
    return this.client.fetchCompetitions();
  }

  async getSeasons(competition_canonical_id: string): Promise<Season[]> {
    if (!this.configured) return [];
    // map canonical_id back to provider code (best-effort; downstream code
    // should pass the provider code when it has it).
    const code = competition_canonical_id.startsWith('league:') ||
                 competition_canonical_id.startsWith('cup:') ||
                 competition_canonical_id.startsWith('competition:')
      ? competition_canonical_id.split(':')[1]
      : competition_canonical_id;
    return this.client.fetchSeasons(code);
  }

  async getFixtures(params?: QueryParams): Promise<Fixture[]> {
    if (!this.configured) return [];
    if (!params?.competition_canonical_id) return [];
    const code = params.competition_canonical_id.split(':').slice(-1)[0] ?? '';
    const matches = await this.client.fetchMatches(code, params.season_canonical_id ? Number(params.season_canonical_id) || new Date().getFullYear() : new Date().getFullYear(), {
      status: 'SCHEDULED',
    });
    // strip the score fields to match Fixture shape (no scores for unplayed matches)
    return matches.map(({ home_score, away_score, half_time_home, half_time_away, winner, ...rest }) => rest as Fixture);
  }

  async getResults(params?: QueryParams): Promise<MatchResult[]> {
    if (!this.configured) return [];
    if (!params?.competition_canonical_id) return [];
    const code = params.competition_canonical_id.split(':').slice(-1)[0] ?? '';
    const matches = await this.client.fetchMatches(code, params.season_canonical_id ? Number(params.season_canonical_id) || new Date().getFullYear() : new Date().getFullYear(), {
      status: 'FINISHED',
    });
    return matches;
  }

  async getStandings(params?: QueryParams): Promise<Standings[]> {
    if (!this.configured) return [];
    if (!params?.competition_canonical_id) return [];
    const code = params.competition_canonical_id.split(':').slice(-1)[0] ?? '';
    return this.client.fetchStandings(code);
  }

  async getTeams(params?: QueryParams): Promise<Team[]> {
    if (!this.configured) return [];
    const code = params?.competition_canonical_id?.split(':').slice(-1)[0];
    return this.client.fetchTeams(code);
  }

  async getMatch(canonical_id: string): Promise<Fixture | MatchResult | null> {
    if (!this.configured) return null;
    // canonical_id is match:fd:<id> for Phase 1.B provisional ids
    const m = canonical_id.match(/^match:fd:(.+)$/);
    if (!m) return null;
    // Phase 1.B: this is a single-fetch operation we have not yet wrapped;
    // returning null keeps the contract honest. Phase 1.C will wire this to
    // a dedicated /matches/{id} endpoint.
    void m;
    return null;
  }
}
