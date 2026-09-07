// Football Factory — Player identity (interface only).
// Phase 1.A: type surface only. Sync, alias resolution, and provider-id
// lookup are deferred to a later sub-phase.
//
// Why interfaces only: player rosters are large, churn frequently, and
// require careful design (multi-team seasons, name changes, ambiguous
// display names like "James" / "Rodriguez"). Landing those decisions in
// Phase 1.A would freeze assumptions we are not ready to commit to.

import type { ProviderName } from '../types';
import { createPlayerCanonicalId, toSlug } from './normalize';

export interface PlayerIdentity {
  canonical_id: string;            // "player:<slug>"
  display_name: string;
  team_canonical_id?: string;
  aliases: string[];
  provider_ids: Partial<Record<ProviderName, string | number>>;
  review_required?: boolean;
}

/**
 * Deterministic player canonical_id helper. Same input → same id.
 * Returns "" for non-Latin names so callers are forced to provide an
 * explicit curated canonical_id instead.
 */
export function createPlayerId(display_name: string): string {
  const slug = toSlug(display_name);
  if (!slug) return '';
  return createPlayerCanonicalId(slug);
}
