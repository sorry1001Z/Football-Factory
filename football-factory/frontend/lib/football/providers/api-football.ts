// ApiFootballProvider — secondary provider stub.
// Real implementation will hit https://v3.football.api-sports.io/.
// Phase 0.C: NO network calls. Returns [] / null.

import { BaseStubProvider } from '../provider';
import type {
  Competition,
  Fixture,
  MatchResult,
  ProviderName,
  Season,
  Standings,
  Team,
} from '../types';

export class ApiFootballProvider extends BaseStubProvider {
  readonly name: ProviderName = 'api-football';

  get configured(): boolean {
    return Boolean(process.env.API_FOOTBALL_KEY);
  }

  async getCompetitions(): Promise<Competition[]> {
    if (!this.configured) {
      console.warn('[api-football] API_FOOTBALL_KEY not set; returning []');
      return [];
    }
    return [];
  }
  async getSeasons(): Promise<Season[]> { return []; }
  async getFixtures(): Promise<Fixture[]> { return []; }
  async getResults(): Promise<MatchResult[]> { return []; }
  async getStandings(): Promise<Standings[]> { return []; }
  async getTeams(): Promise<Team[]> { return []; }
}
