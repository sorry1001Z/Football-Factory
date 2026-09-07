// Football Factory — registry index.
// Phase 1.A: competition registry + collision detection.
// Team + Player registries land in later sub-phases.

import { COMPETITION_REGISTRY } from './competitions';
import type { CompetitionRegistryEntry, TeamRegistryEntry, PlayerIdentityRecord } from './types';

export type { CompetitionRegistryEntry, TeamRegistryEntry, PlayerIdentityRecord } from './types';
export { COMPETITION_REGISTRY };

// ----- read helpers -----

export function listCompetitions(): readonly CompetitionRegistryEntry[] {
  return COMPETITION_REGISTRY;
}

export function listEnabledCompetitions(): readonly CompetitionRegistryEntry[] {
  return COMPETITION_REGISTRY.filter((c) => c.enabled);
}

export function getCompetitionByCanonicalId(canonical_id: string): CompetitionRegistryEntry | null {
  return COMPETITION_REGISTRY.find((c) => c.canonical_id === canonical_id) ?? null;
}

export function getCompetitionByProviderId(
  provider: 'football-data.org' | 'api-football',
  external_id: string | number,
): CompetitionRegistryEntry | null {
  const wanted = String(external_id);
  return COMPETITION_REGISTRY.find((c) => {
    const v = c.provider_ids[provider];
    return v !== undefined && String(v) === wanted;
  }) ?? null;
}

// ----- collision / validation -----

export interface RegistryIssue {
  kind:
    | 'duplicate_canonical_id'
    | 'duplicate_provider_id'
    | 'alias_collision'
    | 'missing_short_name'
    | 'invalid_priority'
    | 'invalid_country';
  canonical_id?: string;
  alias?: string;
  provider?: 'football-data.org' | 'api-football';
  external_id?: string;
  detail: string;
}

/**
 * Detect collisions and structural issues in the registry. The result is a
 * list of issues that must be human-reviewed before the registry is treated
 * as authoritative. Never throws — callers must inspect the array.
 */
export function validateCompetitionRegistry(): RegistryIssue[] {
  const issues: RegistryIssue[] = [];

  // 1. duplicate canonical_ids
  const seenCanonical = new Map<string, string>(); // canonical_id → name
  for (const c of COMPETITION_REGISTRY) {
    if (seenCanonical.has(c.canonical_id)) {
      issues.push({
        kind: 'duplicate_canonical_id',
        canonical_id: c.canonical_id,
        detail: `canonical_id "${c.canonical_id}" already used by "${seenCanonical.get(c.canonical_id)}"`,
      });
    } else {
      seenCanonical.set(c.canonical_id, c.name);
    }
  }

  // 2. duplicate provider_ids per provider
  for (const prov of ['football-data.org', 'api-football'] as const) {
    const seenProv = new Map<string, string>();
    for (const c of COMPETITION_REGISTRY) {
      const v = c.provider_ids[prov];
      if (v === undefined) continue;
      const key = String(v);
      if (seenProv.has(key)) {
        issues.push({
          kind: 'duplicate_provider_id',
          provider: prov,
          external_id: key,
          canonical_id: c.canonical_id,
          detail: `${prov} id "${key}" already used by "${seenProv.get(key)}"`,
        });
      } else {
        seenProv.set(key, c.canonical_id);
      }
    }
  }

  // 3. alias collisions across DIFFERENT canonical_ids
  const aliasIndex = new Map<string, string>(); // lowercased alias → canonical_id
  for (const c of COMPETITION_REGISTRY) {
    const candidates = [c.name, c.short_name, ...c.aliases];
    for (const a of candidates) {
      const key = a.toLowerCase();
      const prior = aliasIndex.get(key);
      if (prior && prior !== c.canonical_id) {
        issues.push({
          kind: 'alias_collision',
          alias: a,
          canonical_id: c.canonical_id,
          detail: `alias "${a}" already claimed by "${prior}"`,
        });
      } else {
        aliasIndex.set(key, c.canonical_id);
      }
    }
  }

  // 4. structural checks
  for (const c of COMPETITION_REGISTRY) {
    if (!c.short_name || c.short_name.trim().length === 0) {
      issues.push({ kind: 'missing_short_name', canonical_id: c.canonical_id, detail: 'short_name is empty' });
    }
    if (typeof c.priority !== 'number' || !Number.isFinite(c.priority) || c.priority < 0) {
      issues.push({ kind: 'invalid_priority', canonical_id: c.canonical_id, detail: `priority=${c.priority}` });
    }
    if (!c.country || c.country.trim().length === 0) {
      issues.push({ kind: 'invalid_country', canonical_id: c.canonical_id, detail: 'country is empty' });
    }
  }

  return issues;
}
