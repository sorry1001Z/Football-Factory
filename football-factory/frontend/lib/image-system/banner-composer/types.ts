// Football Factory — Banner Composer Types (Image System).
//
// Pure advisory contracts. NEVER:
//   - generates an image
//   - generates an AI prompt
//   - evaluates image rights
//   - renders anything
//
// The composer reuses the entity-freshness gate's eligibility
// results to decide WHICH people to include in a future banner,
// WHAT visual role each carries, and HOW the future image
// generator should compose the layout.

import type {
  ArticleType,
  BannerPersonContext,
  EligibilityResult,
  PersonRole,
  PersonTeamRelationship,
  VisualContext,
} from "../entity-freshness/types";

/**
 * One candidate person the caller wants the composer to consider.
 * `relationship` is the authoritative roster record (when known);
 * absence means the freshness gate will receive `roster: undefined`.
 * `articleSubject` marks the person the article is explicitly about
 * and drives the deterministic priority order.
 */
export interface ComposerCandidate {
  personId: string;
  displayName?: string;
  role: PersonRole;
  /**
   * Authoritative roster record for this candidate. When absent,
   * the freshness gate is asked to evaluate without roster data.
   * The composer MUST NOT fabricate relationships.
   */
  relationship?: PersonTeamRelationship;
  /** True when the article itself is about this person. */
  articleSubject?: boolean;
}

export interface BannerComposerInput {
  articleId?: string;
  articleDate: string;
  articleType: ArticleType;
  headline?: string;
  summary?: string;
  teamIds?: readonly string[];
  competitionIds?: readonly string[];
  people: readonly ComposerCandidate[];
  /** Optional roster snapshot covering more candidates. */
  roster?: readonly PersonTeamRelationship[];
  /** Maximum number of selected people. Default 3, hard cap 3. */
  maxPeople?: number;
  /** Optional override for staleness window (days). */
  maxStalenessDays?: number;
}

export type ComposerStatus =
  | "READY"
  | "REQUIRES_REVIEW"
  | "NO_VALID_SUBJECTS";

export type LayoutSuggestion =
  | "SINGLE_SUBJECT"
  | "DUAL_SUBJECT"
  | "TRIPLE_SUBJECT"
  | "TRANSFER_SPLIT"
  | "HISTORICAL"
  | "GENERIC_TEAM";

/** Banner layout-context warnings the future renderer should heed. */
export type BannerWarning =
  | "TRANSFER_PENDING_DO_NOT_IMPLY_NEW_CLUB"
  | "TRANSFER_CONFIRMED_BEFORE_EFFECTIVE_DATE"
  | "MIXED_FORMER_AND_CURRENT"
  | "REQUIRES_REVIEW_INCLUDED"
  | "GENERIC_FALLBACK_RECOMMENDED";

export interface ExcludedPerson {
  personId: string;
  displayName?: string;
  reasons: readonly string[];
}

export interface BannerComposition {
  status: ComposerStatus;
  selectedPeople: readonly BannerPersonContext[];
  excludedPeople: readonly ExcludedPerson[];
  teamIds: readonly string[];
  competitionIds: readonly string[];
  layoutSuggestion: LayoutSuggestion;
  warnings: readonly BannerWarning[];
  /** Mean confidence across selected people; 0 when none selected. */
  confidence: number;
  /**
   * Per-person eligibility audit trail. Future consumers can use
   * this to surface reasons in editorial tooling. The composer
   * itself does NOT render anything from this — pure metadata.
   */
  audit: readonly EligibilityResult[];
}
