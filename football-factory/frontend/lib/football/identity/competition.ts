// Football Factory — competition identity resolution.
// Resolution priority (matches Phase 1.A spec):
//   1. canonical_id exact
//   2. provider_id exact
//   3. normalized alias / name / short_name exact
//   4. unresolved (never guess)

import type { ProviderName } from '../types';
import type { CompetitionRegistryEntry } from '../registry/types';
import {
  COMPETITION_REGISTRY,
  getCompetitionByCanonicalId,
  getCompetitionByProviderId,
} from '../registry';
import { normalizeIdentityKey } from './normalize';

export type ResolveStatus = 'resolved' | 'unresolved' | 'ambiguous';

export interface ResolveResult<T> {
  status: ResolveStatus;
  entity?: T;
  candidates?: T[];
  reason?: string;
}

const PROVIDERS_WITH_IDS: ReadonlyArray<Exclude<ProviderName, 'mock'>> = [
  'football-data.org',
  'api-football',
];

/** 1. Canonical-id exact match. Returns null if not found. */
export function resolveCompetitionByCanonicalId(
  canonical_id: string,
): CompetitionRegistryEntry | null {
  if (!canonical_id) return null;
  return getCompetitionByCanonicalId(canonical_id);
}

/**
 * 2. Provider-id exact match.
 * provider external_id may be string or number depending on the provider.
 */
export function resolveCompetitionByProviderId(
  provider: ProviderName,
  external_id: string | number,
): CompetitionRegistryEntry | null {
  if (provider === 'mock') return null;
  if (!PROVIDERS_WITH_IDS.includes(provider)) return null;
  return getCompetitionByProviderId(provider, external_id);
}

/**
 * 3. Normalized alias / name / short_name exact match.
 * Case-insensitive, whitespace + punctuation normalized. NEVER fuzzy.
 */
export function resolveCompetitionByAlias(
  input: string | null | undefined,
): ResolveResult<CompetitionRegistryEntry> {
  const key = normalizeIdentityKey(input);
  if (!key) {
    return { status: 'unresolved', reason: 'empty or invalid input' };
  }

  const candidates: CompetitionRegistryEntry[] = [];
  for (const c of COMPETITION_REGISTRY) {
    const names = [c.name, c.short_name, ...c.aliases].map(normalizeIdentityKey);
    if (names.includes(key)) candidates.push(c);
  }

  if (candidates.length === 0) {
    return { status: 'unresolved', reason: `no entry matches "${input}"` };
  }
  if (candidates.length === 1) {
    return { status: 'resolved', entity: candidates[0] };
  }
  // More than one candidate means the alias collides across DIFFERENT
  // canonical_ids (the registry validator should already have flagged this,
  // but resolution must still refuse to guess).
  return {
    status: 'ambiguous',
    candidates,
    reason: `alias "${input}" matches ${candidates.length} different competitions`,
  };
}

/**
 * Unified resolver. Tries canonical → provider → alias in that order.
 * Each stage is independent; a failed earlier stage does NOT fall back to
 * a weaker match (otherwise ambiguous aliases could shadow canonical ids).
 */
export function resolveCompetition(
  input: { canonical_id?: string; provider?: ProviderName; external_id?: string | number; alias?: string },
): ResolveResult<CompetitionRegistryEntry> {
  if (input.canonical_id) {
    const direct = resolveCompetitionByCanonicalId(input.canonical_id);
    if (direct) return { status: 'resolved', entity: direct };
    return { status: 'unresolved', reason: `unknown canonical_id "${input.canonical_id}"` };
  }
  if (input.provider && input.external_id !== undefined) {
    const byProv = resolveCompetitionByProviderId(input.provider, input.external_id);
    if (byProv) return { status: 'resolved', entity: byProv };
    return {
      status: 'unresolved',
      reason: `no canonical mapping for ${input.provider} id "${input.external_id}"`,
    };
  }
  if (input.alias !== undefined) {
    return resolveCompetitionByAlias(input.alias);
  }
  return { status: 'unresolved', reason: 'no resolver input provided' };
}
