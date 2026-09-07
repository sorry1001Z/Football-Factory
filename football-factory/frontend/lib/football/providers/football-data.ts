// FootballDataProvider — primary provider stub.
// Real implementation will hit https://api.football-data.org/v4/.
// Phase 0.C: NO network calls. Returns [] / null. Logs a warning if called
// without FOOTBALL_DATA_API_KEY configured.

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

export class FootballDataProvider extends BaseStubProvider {
  readonly name: ProviderName = 'football-data.org';

  get configured(): boolean {
    return Boolean(process.env.FOOTBALL_DATA_API_KEY);
  }

  // Phase 0.C: keep methods but make them obviously inert.
  // Phase 1 will replace bodies with real fetch + normalization.
  async getCompetitions(): Promise<Competition[]> {
    if (!this.configured) {
      console.warn('[football-data] FOOTBALL_DATA_API_KEY not set; returning []');
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
