// Football Factory — team identity resolution.
// Phase 1.A: in-memory seed registry + helpers. The seed list is small and
// will be expanded in later sub-phases. Review_required=true is permitted
// on seed entries and must be cleared by an editor before production use.

import type { ProviderName } from '../types';
import type { TeamRegistryEntry } from '../registry/types';
import { createTeamCanonicalId, normalizeIdentityKey, toSlug } from './normalize';

// ----- in-memory seed registry -------------------------------------------

const TEAM_REGISTRY: TeamRegistryEntry[] = [
  {
    canonical_id: 'team:manchester-united',
    display_name: 'Manchester United',
    short_name: 'Man Utd',
    country: 'England',
    competition_canonical_ids: ['league:premier-league', 'cup:fa-cup', 'cup:carabao-cup'],
    aliases: ['Man United', 'Manchester Utd', 'MUFC', 'แมนยู'],
    provider_ids: {},
  },
  {
    canonical_id: 'team:arsenal',
    display_name: 'Arsenal',
    short_name: 'ARS',
    country: 'England',
    competition_canonical_ids: ['league:premier-league', 'cup:fa-cup', 'cup:carabao-cup'],
    aliases: ['The Gunners', 'อาร์เซนอล'],
    provider_ids: {},
  },
  {
    canonical_id: 'team:liverpool',
    display_name: 'Liverpool',
    short_name: 'LIV',
    country: 'England',
    competition_canonical_ids: ['league:premier-league', 'cup:fa-cup', 'cup:carabao-cup'],
    aliases: ['The Reds', 'ลิเวอร์พูล'],
    provider_ids: {},
  },
  {
    canonical_id: 'team:real-madrid',
    display_name: 'Real Madrid',
    short_name: 'RM',
    country: 'Spain',
    competition_canonical_ids: ['league:laliga', 'cup:copa-del-rey', 'competition:uefa-champions-league'],
    aliases: ['Real Madrid CF', 'เรอัล มาดริด'],
    provider_ids: {},
  },
  {
    canonical_id: 'team:barcelona',
    display_name: 'Barcelona',
    short_name: 'BAR',
    country: 'Spain',
    competition_canonical_ids: ['league:laliga', 'cup:copa-del-rey', 'competition:uefa-champions-league'],
    aliases: ['FC Barcelona', 'บาร์เซโลนา'],
    provider_ids: {},
  },
  {
    canonical_id: 'team:bayern-munich',
    display_name: 'Bayern Munich',
    short_name: 'FCB',
    country: 'Germany',
    competition_canonical_ids: ['league:bundesliga', 'cup:dfb-pokal', 'competition:uefa-champions-league'],
    aliases: ['FC Bayern', 'Bayern München', 'บาเยิร์น มิวนิค'],
    provider_ids: {},
  },
  {
    canonical_id: 'team:juventus',
    display_name: 'Juventus',
    short_name: 'JUV',
    country: 'Italy',
    competition_canonical_ids: ['league:serie-a', 'cup:coppa-italia', 'competition:uefa-champions-league'],
    aliases: ['Juve', 'ยูเวนตุส'],
    provider_ids: {},
  },
  {
    canonical_id: 'team:paris-saint-germain',
    display_name: 'Paris Saint-Germain',
    short_name: 'PSG',
    country: 'France',
    competition_canonical_ids: ['league:ligue-1', 'cup:coupe-de-france', 'competition:uefa-champions-league'],
    aliases: ['PSG', 'ปารีส แซง-แชร์แม็ง'],
    provider_ids: {},
  },
];

// ----- read helpers -----

export function listTeams(): readonly TeamRegistryEntry[] {
  return TEAM_REGISTRY;
}

export function getTeamByCanonicalId(canonical_id: string): TeamRegistryEntry | null {
  return TEAM_REGISTRY.find((t) => t.canonical_id === canonical_id) ?? null;
}

export function getTeamByProviderId(
  provider: ProviderName,
  external_id: string | number,
): TeamRegistryEntry | null {
  if (provider === 'mock') return null;
  const wanted = String(external_id);
  return TEAM_REGISTRY.find((t) => {
    const v = t.provider_ids[provider];
    return v !== undefined && String(v) === wanted;
  }) ?? null;
}

// ----- deterministic canonical-id helper ---------------------------------

/**
 * Deterministic: same input → same canonical_id. Used by tools that ingest
 * team names from sources and need a stable key. NEVER use the display
 * name as a primary key in stored records — always go through this helper
 * (or an explicit curated canonical_id).
 */
export function deterministicTeamCanonicalId(display_name: string): string {
  const slug = toSlug(display_name);
  if (!slug) {
    // Non-Latin name: callers must supply a curated canonical_id.
    // Returning a sentinel lets the test suite detect this case.
    return '';
  }
  return createTeamCanonicalId(slug);
}

// ----- alias / provider-id resolvers -------------------------------------

export interface TeamResolveResult {
  status: 'resolved' | 'unresolved' | 'ambiguous';
  entity?: TeamRegistryEntry;
  candidates?: TeamRegistryEntry[];
  reason?: string;
}

export function resolveTeamByCanonicalId(canonical_id: string): TeamRegistryEntry | null {
  if (!canonical_id) return null;
  return getTeamByCanonicalId(canonical_id);
}

export function resolveTeamByProviderId(
  provider: ProviderName,
  external_id: string | number,
): TeamRegistryEntry | null {
  return getTeamByProviderId(provider, external_id);
}

export function resolveTeamByAlias(input: string | null | undefined): TeamResolveResult {
  const key = normalizeIdentityKey(input);
  if (!key) return { status: 'unresolved', reason: 'empty or invalid input' };

  const candidates: TeamRegistryEntry[] = [];
  for (const t of TEAM_REGISTRY) {
    const names = [t.display_name, t.short_name ?? '', ...t.aliases].map(normalizeIdentityKey);
    if (names.includes(key)) candidates.push(t);
  }

  if (candidates.length === 0) return { status: 'unresolved', reason: `no team matches "${input}"` };
  if (candidates.length === 1) return { status: 'resolved', entity: candidates[0] };
  return {
    status: 'ambiguous',
    candidates,
    reason: `alias "${input}" matches ${candidates.length} different teams`,
  };
}

export function resolveTeam(input: {
  canonical_id?: string;
  provider?: ProviderName;
  external_id?: string | number;
  alias?: string;
}): TeamResolveResult {
  if (input.canonical_id) {
    const direct = resolveTeamByCanonicalId(input.canonical_id);
    if (direct) return { status: 'resolved', entity: direct };
    return { status: 'unresolved', reason: `unknown canonical_id "${input.canonical_id}"` };
  }
  if (input.provider && input.external_id !== undefined) {
    const byProv = resolveTeamByProviderId(input.provider, input.external_id);
    if (byProv) return { status: 'resolved', entity: byProv };
    return {
      status: 'unresolved',
      reason: `no team mapping for ${input.provider} id "${input.external_id}"`,
    };
  }
  if (input.alias !== undefined) return resolveTeamByAlias(input.alias);
  return { status: 'unresolved', reason: 'no resolver input provided' };
}
