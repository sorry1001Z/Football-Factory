// Football data layer public surface.
// Phase 0.C exposes provider selection and health; not yet the routers.
//
// SERVER-ONLY: this module must never be imported by a client component.
// It reads server-only env vars (FOOTBALL_DATA_API_KEY, API_FOOTBALL_KEY,
// FOOTBALL_PROVIDER_MODE). Phase 0.D+ may add an explicit `import 'server-only'`
// guard once the `server-only` npm package is installed.

import type { ProviderName } from './types';
import type { FootballProvider } from './provider';
import { FootballDataProvider } from './providers/football-data';
import { ApiFootballProvider } from './providers/api-football';

export type { FootballProvider } from './provider';
export * from './types';

export function getProvider(name?: ProviderName): FootballProvider {
  const requested = (name ?? process.env.FOOTBALL_PROVIDER_MODE ?? 'primary').toLowerCase();

  if (requested === 'secondary') return new ApiFootballProvider();
  if (requested === 'mock') return new ApiFootballProvider(); // Phase 1 will add real MockProvider
  // default + 'primary' + 'auto'
  return new FootballDataProvider();
}

export function listProviders(): FootballProvider[] {
  return [new FootballDataProvider(), new ApiFootballProvider()];
}
