// Football Factory — provider resolver (Phase 1.C).
// Validates the requested provider name against an explicit allowlist and
// returns a configured provider instance. Invalid requests surface as
// CONFIG_ERROR. The resolver never logs or returns API keys.

import { FootballDataProvider } from './providers/football-data';
import { ApiFootballProvider } from './providers/api-football';
import type { FootballProvider } from './provider';
import type { ProviderName } from './types';

export type ResolvableProvider = Exclude<ProviderName, 'mock'>;

const ALLOWED: ReadonlySet<ResolvableProvider> = new Set([
  'football-data.org',
  'api-football',
]);

export interface ProviderResolverOptions {
  api_keys?: Partial<Record<ResolvableProvider, string | undefined>>;
}

export class ProviderResolutionError extends Error {
  readonly requested: string;
  readonly allowed: ReadonlyArray<ResolvableProvider>;
  constructor(requested: string, allowed: ReadonlyArray<ResolvableProvider>) {
    super(`provider not allowed: "${requested}" (allowed: ${allowed.join(',')})`);
    this.name = 'ProviderResolutionError';
    this.requested = requested;
    this.allowed = allowed;
  }
  toJSON(): unknown {
    return { name: this.name, requested: this.requested, allowed: [...this.allowed] };
  }
}

export function listAllowedProviders(): ReadonlyArray<ResolvableProvider> {
  return [...ALLOWED];
}

export function isAllowedProvider(name: string): name is ResolvableProvider {
  return ALLOWED.has(name as ResolvableProvider);
}

/**
 * Resolve a string provider name to a FootballProvider.
 *
 * Resolution rules:
 *   - 'football-data.org' → FootballDataProvider
 *   - 'api-football'       → ApiFootballProvider
 *   - anything else        → throw ProviderResolutionError (caller maps to CONFIG_ERROR)
 *   - empty / undefined    → defaults to 'football-data.org' (primary)
 *
 * @throws ProviderResolutionError
 */
export function resolveProvider(
  requested: string | undefined,
  options: ProviderResolverOptions = {},
): FootballProvider {
  const name = (requested ?? 'football-data.org').trim().toLowerCase();
  if (name === 'football-data.org') {
    return new FootballDataProvider(options.api_keys?.['football-data.org']);
  }
  if (name === 'api-football') {
    return new ApiFootballProvider(options.api_keys?.['api-football']);
  }
  throw new ProviderResolutionError(name, [...ALLOWED]);
}
