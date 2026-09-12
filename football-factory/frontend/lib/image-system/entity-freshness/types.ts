// Football Factory — Entity Freshness Types (Image System).
//
// Concerns:
//   1. Are we using a person who is contextually correct for this
//      team/article-date (current/active vs former vs transfer)?
//   2. Is the data fresh enough to trust?
//
// This is a SEPARATE concern from rights (lib/image-system/policy.ts):
//   - Rights: can we legally use this asset?
//   - Freshness: is this person contextually correct for this team?
//
// Both must eventually pass independently. This module does NOT
// touch rights evaluation and does NOT touch image rendering.

/** Supported person roles. Future-compatible. */
export type PersonRole = "PLAYER" | "MANAGER" | "COACH" | "STAFF";

/** Status of a person-team relationship at any instant. */
export type RelationshipStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "TRANSFER_PENDING"
  | "TRANSFER_CONFIRMED"
  | "LOAN"
  | "FREE_AGENT"
  | "UNKNOWN";

/**
 * Article context types. Drives eligibility rules.
 *   CURRENT_NEWS / MATCH_NEWS: person must be currently active.
 *   TRANSFER_NEWS: contextual — see evaluateTransferContext().
 *   HISTORICAL: any former person is valid; explicit marker.
 *   FEATURE / PROFILE: depends on whether the article is about
 *     a former vs current person.
 */
export type ArticleType =
  | "CURRENT_NEWS"
  | "TRANSFER_NEWS"
  | "MATCH_NEWS"
  | "FEATURE"
  | "HISTORICAL"
  | "PROFILE";

/** Context the banner represents the person as. */
export type VisualContext =
  | "CURRENT_CLUB"
  | "FORMER_CLUB"
  | "TARGET_CLUB"
  | "NEW_CLUB"
  | "PROFILE_SUBJECT"
  | "HISTORICAL_SUBJECT"
  | "MATCH_SUBJECT";

/**
 * Normalized person-team relationship with temporal validity.
 * `validFrom` / `validTo` are ISO date strings (YYYY-MM-DD or full ISO).
 * Do NOT invent missing dates — leave undefined if unknown.
 */
export interface PersonTeamRelationship {
  /** Stable person canonical id (Football identity registry). */
  personId: string;
  /** Stable team canonical id (Football identity registry). */
  teamId: string;
  /** Role the person held with this team. */
  role: PersonRole;
  /** ISO date the relationship started. Optional; if absent the
   *  relationship is treated as ongoing with unknown start. */
  validFrom?: string;
  /** ISO date the relationship ended. Optional; absence means
   *  "still ongoing as far as this record knows". */
  validTo?: string;
  /** Authoritative status. */
  status: RelationshipStatus;
  /** Free-text source (e.g. "wikipedia", "club-official"). */
  source?: string;
  /** ISO timestamp when this record was last verified. */
  verifiedAt?: string;
}

/** Banner-eligibility decision string. */
export type EligibilityDecision =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "REQUIRES_REVIEW";

/** Reason codes returned by the evaluator. */
export type EligibilityReason =
  | "ACTIVE_AT_DATE"
  | "FORMER_AT_DATE"
  | "TRANSFER_PENDING_NO_NEW_CLUB"
  | "TRANSFER_CONFIRMED_NEW_CLUB"
  | "HISTORICAL_EXCEPTION"
  | "PROFILE_SUBJECT_FORMER"
  | "PROFILE_SUBJECT_CURRENT"
  | "MATCH_SUBJECT"
  | "STALE_DATA"
  | "PERSON_TEAM_UNKNOWN"
  | "MANAGER_STATUS_UNKNOWN"
  | "TRANSFER_STATUS_UNCONFIRMED"
  | "RELATION_DATE_UNKNOWN"
  | "VISUAL_CONTEXT_MISMATCH"
  | "ARTICLE_TYPE_NOT_CURRENT_NEWS"
  | "BANNER_COMBINATION_NO_TEMPORAL_OVERLAP"
  | "BANNER_COMBINATION_OVERLAP_OK"
  | "ARTICLE_DATE_MISSING";

export interface BannerPersonContext {
  personId: string;
  displayName?: string;
  role: PersonRole;
  currentTeamId?: string;
  formerTeamIds?: readonly string[];
  visualContext: VisualContext;
  articleDate: string;
}

export interface EligibilityResult {
  eligible: boolean;
  decision: EligibilityDecision;
  personId: string;
  teamId?: string;
  role?: PersonRole;
  relationshipStatus?: RelationshipStatus;
  visualContext?: VisualContext;
  reasons: readonly EligibilityReason[];
  verifiedAt?: string;
  /**
   * Confidence in [0, 1]. 1.0 = authoritative ACTIVE relationship
   * within window; 0.0 = no data; intermediate = partial signal.
   */
  confidence: number;
}

/**
 * Banner combination evaluator input — evaluates 1..3 people
 * together for one banner. Each person must be eligible
 * independently for the banner to be considered valid.
 */
export interface BannerCombinationInput {
  articleDate: string;
  articleType?: ArticleType;
  /** Team(s) the article is contextually about. */
  teamIds?: readonly string[];
  /** Person entries to evaluate. */
  people: readonly BannerPersonContext[];
  /** Optional roster snapshot the caller has on hand. */
  roster?: readonly PersonTeamRelationship[];
}
