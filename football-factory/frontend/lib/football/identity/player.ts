// Football Factory — Player identity (interface only).
// Phase 1.A: type surface only. Sync, alias resolution, and provider-id
// lookup are deferred to a later sub-phase.
//
// Why interfaces only: player rosters are large, churn frequently, and
// require careful design (multi-team seasons, name changes, ambiguous
// display names like "James" / "Rodriguez"). Landing those decisions in
// Phase 1.A would freeze assumptions we are not ready to commit to.
//
// Set #3 Wave A: extended `PlayerIdentity` with an optional
// `resolution` field for callers that opt into the new person
// resolver, and re-exported the resolver entry point under the
// player-namespaced name `resolvePlayerIdentity`. Purely additive —
// existing callers that ignore the new field continue to compile and
// run unchanged.

import type { ProviderName } from '../types';
import { createPlayerCanonicalId, toSlug } from './normalize';
import type { PersonResolutionResult } from './person-resolver';

export interface PlayerIdentity {
  canonical_id: string;            // "player:<slug>"
  display_name: string;
  team_canonical_id?: string;
  aliases: string[];
  provider_ids: Partial<Record<ProviderName, string | number>>;
  review_required?: boolean;
  /**
   * Optional last-resolution metadata from `resolvePlayerIdentity()`.
   * Set only when a caller asked the resolver to evaluate this
   * player against a ProviderPersonIdentity input. NEVER used to
   * mutate `canonical_id` — observational metadata only.
   */
  resolution?: PersonResolutionResult;
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

// Re-export the resolver entry point under the player-namespaced name
// so callers searching for player identity resolution land on it
// without needing to know the file name. This is a pure re-export;
// resolvePersonIdentity itself never fabricates canonical_ids and
// never bypasses createPlayerId's non-Latin invariant.
export {
  resolvePersonIdentity as resolvePlayerIdentity,
  scorePersonCandidate as scorePlayerCandidate,
} from './person-resolver';
