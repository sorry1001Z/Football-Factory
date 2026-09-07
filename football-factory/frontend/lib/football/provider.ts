// FootballProvider — provider-agnostic interface.
// Every concrete provider MUST return canonical Football Factory types.
// NEVER return a raw provider payload.
//
// Phase 0.C: stubs only. Real network calls are gated behind
// `configured` checks (env keys must be present) and are NOT made
// during Phase 0.C. A no-key call returns [] / empty objects and
// emits a warning log line.

import type {
  Competition,
  Fixture,
  MatchResult,
  ProviderName,
  QueryParams,
  Season,
  Standings,
  Team,
} from './types';

export interface ProviderHealth {
  provider: ProviderName;
  configured: boolean;
  reason?: string;
}

export interface FootballProvider {
  readonly name: ProviderName;
  readonly configured: boolean;

  health(): Promise<ProviderHealth>;
  getCompetitions(params?: QueryParams): Promise<Competition[]>;
  getSeasons(competition_canonical_id: string): Promise<Season[]>;
  getFixtures(params?: QueryParams): Promise<Fixture[]>;
  getResults(params?: QueryParams): Promise<MatchResult[]>;
  getStandings(params?: QueryParams): Promise<Standings[]>;
  getTeams(params?: QueryParams): Promise<Team[]>;
  getMatch(canonical_id: string): Promise<Fixture | MatchResult | null>;
}

// Shared base — keeps stubs concise and uniform.
export abstract class BaseStubProvider implements FootballProvider {
  abstract readonly name: ProviderName;
  abstract readonly configured: boolean;

  async health(): Promise<ProviderHealth> {
    return { provider: this.name, configured: this.configured };
  }

  async getCompetitions(): Promise<Competition[]> { return []; }
  async getSeasons(): Promise<Season[]> { return []; }
  async getFixtures(): Promise<Fixture[]> { return []; }
  async getResults(): Promise<MatchResult[]> { return []; }
  async getStandings(): Promise<Standings[]> { return []; }
  async getTeams(): Promise<Team[]> { return []; }
  async getMatch(): Promise<Fixture | MatchResult | null> { return null; }
}
