// Football Factory — API-Football (api-sports) client.
// Phase 1.B: thin wrapper around fetchJson + normalizer. Role: SECONDARY.
// NO network calls without API_FOOTBALL_KEY present.

import type {
  Competition,
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
  normalizeApiFootballCompetition,
  normalizeApiFootballTeam,
  normalizeApiFootballSeason,
  normalizeApiFootballMatch,
  normalizeApiFootballStandings,
  pickApiFootballList,
} from './api-football.normalize';

const PROVIDER: ProviderName = 'api-football';

interface ApiFootballClientOptions {
  base_url?: string;
}

export class ApiFootballClient {
  readonly base_url: string;
  private readonly apiKey: string | undefined;

  constructor(apiKey: string | undefined, options: ApiFootballClientOptions = {}) {
    this.apiKey = apiKey;
    this.base_url = options.base_url ?? 'https://v3.football.api-sports.io';
  }

  /** Override JSON serialization to NEVER expose the API key. */
  toJSON(): unknown {
    return { provider: 'api-football', base_url: this.base_url, configured: this.configured };
  }

  get configured(): boolean {
    return Boolean(this.apiKey) && this.apiKey !== 'replace-with-a-long-random-secret';
  }

  private authHeader(): Record<string, string> {
    if (!this.configured) {
      throw new ProviderError('CONFIG_ERROR', PROVIDER, 'API_FOOTBALL_KEY not configured');
    }
    return { 'x-apisports-key': this.apiKey as string };
  }

  private async getJson(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    return fetchJson(PROVIDER, `${this.base_url}${path}`, this.authHeader(), {
      query,
      timeout_ms: 10_000,
    });
  }

  async fetchCompetitions(): Promise<Competition[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson('/leagues');
    return pickApiFootballList<Competition>(
      raw,
      'response',
      (item) => normalizeApiFootballCompetition(item, fetched_at).record,
      fetched_at,
    );
  }

  async fetchSeasons(leagueId: number): Promise<Season[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson('/leagues', { id: leagueId });
    if (!raw || typeof raw !== 'object') return [];
    const response = (raw as Record<string, unknown>)['response'];
    if (!Array.isArray(response) || response.length === 0) return [];
    const first = response[0];
    if (!first || typeof first !== 'object') return [];
    const seasons = (first as Record<string, unknown>)['seasons'];
    if (!Array.isArray(seasons)) return [];
    return seasons
      .map((s) => normalizeApiFootballSeason(s, '', fetched_at))
      .filter((s): s is Season => s !== null);
  }

  async fetchTeams(leagueId: number, season: number): Promise<Team[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson('/teams', { league: leagueId, season });
    return pickApiFootballList<Team>(
      raw,
      'response',
      (item) => normalizeApiFootballTeam(item, fetched_at).record,
      fetched_at,
    );
  }

  async fetchFixtures(
    leagueId: number,
    season: number,
    options: { next?: number; last?: number; from?: string; to?: string; status?: string } = {},
  ): Promise<MatchResult[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson('/fixtures', {
      league: leagueId,
      season,
      next: options.next,
      last: options.last,
      from: options.from,
      to: options.to,
      status: options.status,
    });
    const fixtures = pickApiFootballList<MatchResult | null>(
      raw,
      'response',
      (item) => normalizeApiFootballMatch(item, fetched_at),
      fetched_at,
    ).filter((m): m is MatchResult => m !== null);
    return fixtures;
  }

  async fetchStandings(leagueId: number, season: number): Promise<Standings[]> {
    const fetched_at = new Date().toISOString();
    const raw = await this.getJson('/standings', { league: leagueId, season });
    if (!raw || typeof raw !== 'object') return [];
    const response = (raw as Record<string, unknown>)['response'];
    return normalizeApiFootballStandings(response, '', fetched_at);
  }

  // Test/Phase 1.C helper: allow injecting a fake response shape.
  async parseMatch(raw: unknown, fetched_at: string): Promise<MatchResult | null> {
    return normalizeApiFootballMatch(raw, fetched_at);
  }

  async parseCompetition(raw: unknown, fetched_at: string): Promise<Competition> {
    return normalizeApiFootballCompetition(raw, fetched_at).record;
  }

  async parseTeam(raw: unknown, fetched_at: string): Promise<Team> {
    return normalizeApiFootballTeam(raw, fetched_at).record;
  }

  async parseStandings(raw: unknown, fetched_at: string): Promise<Standings[]> {
    if (!raw || typeof raw !== 'object') return [];
    const response = (raw as Record<string, unknown>)['response'];
    return normalizeApiFootballStandings(response, '', fetched_at);
  }
}

/**
 * Provider class. Secondary role. Mirrors the FootballDataProvider surface
 * so the orchestration layer can treat both uniformly.
 */
export class ApiFootballProvider extends BaseStubProvider {
  readonly name: ProviderName = 'api-football';
  private readonly client: ApiFootballClient;

  constructor(apiKey: string | undefined = process.env.API_FOOTBALL_KEY) {
    super();
    this.client = new ApiFootballClient(apiKey);
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

  async getSeasons(_competition_canonical_id: string): Promise<Season[]> {
    if (!this.configured) return [];
    // provider id mapping happens in the client caller; the provider-class
    // surface accepts canonical_id but does not (yet) translate it to a
    // numeric api-football id. Phase 1.B returns []. Phase 1.C will use the
    // resolved registry mapping.
    return [];
  }

  async getFixtures(params?: QueryParams): Promise<Fixture[]> {
    if (!this.configured) return [];
    const matches = await this.client.fetchFixtures(0, new Date().getFullYear(), {
      next: 20,
    });
    return matches.map(({ home_score, away_score, half_time_home, half_time_away, winner, ...rest }) => rest as Fixture);
  }

  async getResults(params?: QueryParams): Promise<MatchResult[]> {
    if (!this.configured) return [];
    return this.client.fetchFixtures(0, new Date().getFullYear(), {
      last: 20,
    });
  }

  async getStandings(_params?: QueryParams): Promise<Standings[]> {
    if (!this.configured) return [];
    // Same caveat as getSeasons: provider-class needs a numeric league id
    // mapping. Phase 1.B returns []. Phase 1.C will plumb through.
    return [];
  }

  async getTeams(_params?: QueryParams): Promise<Team[]> {
    if (!this.configured) return [];
    return [];
  }

  async getMatch(canonical_id: string): Promise<Fixture | MatchResult | null> {
    if (!this.configured) return null;
    const m = canonical_id.match(/^match:af:(.+)$/);
    if (!m) return null;
    void m;
    return null;
  }
}
