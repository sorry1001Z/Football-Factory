// Football Factory — registry types.
// Phase 1.A: static configuration / identity metadata only.
// Runtime provenance (provider, fetched_at, data_quality_status) lives in
// lib/football/types.ts and is NOT duplicated here.

import type { ProviderName } from '../types';

export type CompetitionType = 'league' | 'cup' | 'continental';

/**
 * Static identity record for a Competition. This is the canonical registry
 * entry used by identity resolution, navigation, and SEO.
 *
 * NOTE: canonical_id uses a type-prefix slug ("league:", "competition:",
 * "cup:") so that future entity kinds can use the same namespace safely.
 */
export interface CompetitionRegistryEntry {
  canonical_id: string;           // "league:premier-league"
  name: string;                   // canonical display name
  short_name: string;             // short display name / abbreviation
  country: string;                // "England", "Spain", "UEFA", ...
  competition_type: CompetitionType;
  priority: number;               // higher = more important (used for UI sort)
  enabled: boolean;               // global enable flag
  aliases: string[];              // alternative display names (en + th safe)
  provider_ids: Partial<Record<ProviderName, string | number>>;
}

/**
 * Static identity record for a Team. Display name is NEVER a primary key —
 * use canonical_id. Aliases are matched case-insensitively after
 * normalization. Provider IDs are exact-match only.
 */
export interface TeamRegistryEntry {
  canonical_id: string;           // "team:manchester-united"
  display_name: string;           // canonical display name
  short_name?: string;
  country?: string;
  competition_canonical_ids: string[];
  aliases: string[];
  provider_ids: Partial<Record<ProviderName, string | number>>;
  review_required?: boolean;      // set true when registered by hand and not yet confirmed
}

/**
 * Player identity record (interface only — full sync deferred).
 * Phase 1.A only requires compile-time type coverage; instantiation and
 * sync land in a later phase.
 */
export interface PlayerIdentityRecord {
  canonical_id: string;           // "player:<slug>"
  display_name: string;
  team_canonical_id?: string;
  aliases: string[];
  provider_ids: Partial<Record<ProviderName, string | number>>;
  review_required?: boolean;
}
