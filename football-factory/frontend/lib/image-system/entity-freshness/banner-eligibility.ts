// Football Factory — Banner Eligibility Evaluator (Image System).
//
// Pure decision function. NEVER:
//   - modifies image rights
//   - generates an AI prompt
//   - touches image rendering
//   - writes anywhere
//
// Returns a structured EligibilityResult that downstream callers
// (banner composer, news article generator) can use to decide
// which people to display. Does NOT itself render an image.

import type {
  ArticleType,
  BannerCombinationInput,
  BannerPersonContext,
  EligibilityDecision,
  EligibilityReason,
  EligibilityResult,
  PersonRole,
  PersonTeamRelationship,
  RelationshipStatus,
  VisualContext,
} from "./types";
import {
  DEFAULT_MAX_STALENESS_DAYS,
  findRelationship,
  isActiveAt,
  isFormerAt,
  isStale,
  parseArticleDate,
  relationshipsOverlapAtDate,
  visualContextFromRelationship,
} from "./person-team-validity";

/**
 * Evaluate a single person's banner eligibility.
 *
 * `articleType` drives rules:
 *   - HISTORICAL: any former person is eligible.
 *   - PROFILE: eligible as long as the person IS the subject.
 *   - TRANSFER_NEWS: contextual handling — see reasons.
 *   - CURRENT_NEWS / MATCH_NEWS / FEATURE (default): must be
 *     ACTIVE for the article team at articleDate, OR an explicit
 *     transfer-confirmed record places them at a NEW_CLUB.
 *
 * If the relationship is unknown or stale, returns
 * `REQUIRES_REVIEW` rather than guessing.
 */
export function evaluateBannerPersonEligibility(args: {
  person: BannerPersonContext;
  articleType: ArticleType;
  articleDate: string;
  teamIds?: readonly string[];
  roster?: readonly PersonTeamRelationship[];
  maxStalenessDays?: number;
}): EligibilityResult {
  const { person, articleType, articleDate, teamIds, roster, maxStalenessDays } = args;
  const BASE_DATE_MS = parseArticleDate(articleDate);
  const reasons: EligibilityReason[] = [];

  if (!Number.isFinite(BASE_DATE_MS)) {
    return makeReviewResult(person, ["ARTICLE_DATE_MISSING"], undefined, undefined);
  }

  // Find the most-specific team on the article that we should test
  // the person against. Default to currentTeamId if no teamIds
  // provided.
  const focusTeamId = person.currentTeamId ?? teamIds?.[0];
  if (!focusTeamId) {
    return makeReviewResult(person, ["PERSON_TEAM_UNKNOWN"], undefined, undefined);
  }

  const rel = findRelationship(roster, person.personId, focusTeamId);

  // Staleness check applies BEFORE the freshness rule so callers
  // know the relationship data is too old to trust.
  const stale = isStale(rel, articleDate, maxStalenessDays ?? DEFAULT_MAX_STALENESS_DAYS);
  if (stale && rel) reasons.push("STALE_DATA");

  // Helper: downgrade an "ELIGIBLE" outcome to REQUIRES_REVIEW
  // when the data is stale. Stale data escalates confidence but
  // reduces the decision's authority.
  const downgradeForStaleness = (r: EligibilityResult): EligibilityResult =>
    stale && rel
      ? {
          ...r,
          eligible: false,
          decision: "REQUIRES_REVIEW",
          confidence: Math.min(r.confidence, 0.6),
        }
      : r;

  // HISTORICAL exception — any former is eligible.
  if (articleType === "HISTORICAL") {
    if (rel) {
      reasons.push("HISTORICAL_EXCEPTION");
      return downgradeForStaleness(
        makeEligibleResult(person, rel, "HISTORICAL_SUBJECT", reasons, "HISTORICAL_SUBJECT"),
      );
    }
    // Even without a record, a historical article about a person
    // we cannot identify is REVIEW (don't fabricate).
    return makeReviewResult(person, ["PERSON_TEAM_UNKNOWN"], undefined, undefined);
  }

  // PROFILE — person IS the subject, even if former.
  if (articleType === "PROFILE") {
    if (rel && isFormerAt(rel, articleDate)) {
      reasons.push("PROFILE_SUBJECT_FORMER");
      return downgradeForStaleness(
        makeEligibleResult(person, rel, "PROFILE_SUBJECT", reasons, "FORMER_CLUB"),
      );
    }
    if (rel && isActiveAt(rel, articleDate)) {
      reasons.push("PROFILE_SUBJECT_CURRENT");
      return downgradeForStaleness(
        makeEligibleResult(person, rel, "PROFILE_SUBJECT", reasons, "CURRENT_CLUB"),
      );
    }
    if (!rel) {
      return makeReviewResult(person, ["PERSON_TEAM_UNKNOWN"], undefined, undefined);
    }
    return makeReviewResult(person, ["RELATION_DATE_UNKNOWN"], rel, rel.role);
  }

  // TRANSFER_NEWS — special handling.
  if (articleType === "TRANSFER_NEWS") {
    if (!rel) {
      return makeReviewResult(person, ["TRANSFER_STATUS_UNCONFIRMED"], undefined, person.role);
    }
    if (rel.status === "TRANSFER_PENDING") {
      reasons.push("TRANSFER_PENDING_NO_NEW_CLUB");
      // Eligible as CURRENT_CLUB context only — the player is
      // still officially at the current team until the move is
      // confirmed.
      return downgradeForStaleness(
        makeEligibleResult(person, rel, "CURRENT_CLUB", reasons, "CURRENT_CLUB"),
      );
    }
    if (rel.status === "TRANSFER_CONFIRMED" && isActiveAt(rel, articleDate)) {
      reasons.push("TRANSFER_CONFIRMED_NEW_CLUB");
      return downgradeForStaleness(
        makeEligibleResult(person, rel, "NEW_CLUB", reasons, "NEW_CLUB"),
      );
    }
    if (rel.status === "TRANSFER_CONFIRMED") {
      // Confirmed transfer whose validFrom is in the future
      // relative to articleDate. NOT yet a new-club member.
      reasons.push("TRANSFER_PENDING_NO_NEW_CLUB");
      return downgradeForStaleness(
        makeEligibleResult(person, rel, "CURRENT_CLUB", reasons, "CURRENT_CLUB"),
      );
    }
    if (isActiveAt(rel, articleDate)) {
      reasons.push("ACTIVE_AT_DATE");
      return downgradeForStaleness(
        makeEligibleResult(person, rel, "CURRENT_CLUB", reasons, "CURRENT_CLUB"),
      );
    }
    if (isFormerAt(rel, articleDate)) {
      reasons.push("FORMER_AT_DATE");
      return makeNotEligibleResult(person, rel, "FORMER_CLUB", reasons);
    }
    return makeReviewResult(person, ["TRANSFER_STATUS_UNCONFIRMED"], rel, rel.role);
  }

  // Default: CURRENT_NEWS / MATCH_NEWS / FEATURE.
  if (!rel) {
    return makeReviewResult(person, ["PERSON_TEAM_UNKNOWN"], undefined, person.role);
  }
  // TRANSFER_CONFIRMED with articleDate >= validFrom is the
  // canonical case where the player has actually joined the new
  // club by the article date. visualContext MUST be NEW_CLUB for
  // this case — not CURRENT_CLUB — so the banner never implies
  // the player is still at the previous club after the move is
  // effective.
  if (rel.status === "TRANSFER_CONFIRMED" && isActiveAt(rel, articleDate)) {
    reasons.push("TRANSFER_CONFIRMED_NEW_CLUB");
    return downgradeForStaleness(
      makeEligibleResult(person, rel, "NEW_CLUB", reasons, "NEW_CLUB"),
    );
  }
  // TRANSFER_PENDING: the player is NOT yet at the new club but
  // IS still officially a member of their current club. The
  // relationship record's teamId is the new (target) club — the
  // caller is asking "is this person a current member of THIS
  // club right now?" For a TRANSFER_PENDING, the answer is no,
  // but the player is still a valid current-club subject for any
  // banner about their current club (we mark them eligible as
  // CURRENT_CLUB and the composer attaches the
  // TRANSFER_PENDING_DO_NOT_IMPLY_NEW_CLUB warning).
  if (rel.status === "TRANSFER_PENDING") {
    reasons.push("TRANSFER_PENDING_NO_NEW_CLUB");
    return downgradeForStaleness(
      makeEligibleResult(person, rel, "CURRENT_CLUB", reasons, "CURRENT_CLUB"),
    );
  }
  if (isActiveAt(rel, articleDate)) {
    reasons.push("ACTIVE_AT_DATE");
    return downgradeForStaleness(
      makeEligibleResult(person, rel, "CURRENT_CLUB", reasons, "CURRENT_CLUB"),
    );
  }
  if (isFormerAt(rel, articleDate)) {
    reasons.push("FORMER_AT_DATE");
    return makeNotEligibleResult(person, rel, "FORMER_CLUB", reasons);
  }
  // We have a record but the relationship is in the future relative
  // to articleDate (e.g. TRANSFER_CONFIRMED with validFrom > date).
  // In current-news context this person is NOT a current member yet.
  reasons.push("FORMER_AT_DATE");
  return makeNotEligibleResult(person, rel, "FORMER_CLUB", reasons);
}

/**
 * Evaluate a banner combination (1..3 people). Each person is
 * evaluated independently. The combined decision is the worst of
 * the per-person decisions. Multi-person combinations ALSO require
 * pair-wise temporal overlap (manager + players must have
 * co-existed at the club).
 */
export function evaluateBannerCombination(
  input: BannerCombinationInput,
): readonly EligibilityResult[] {
  if (!Array.isArray(input.people) || input.people.length === 0) return [];
  const perPerson = input.people.map((p) =>
    evaluateBannerPersonEligibility({
      person: p,
      articleType: input.articleType ?? "CURRENT_NEWS",
      articleDate: input.articleDate,
      teamIds: input.teamIds,
      roster: input.roster,
    }),
  );
  // Add cross-person temporal overlap check for combinations.
  return annotateCombinationOverlap(perPerson, input);
}

/**
 * Add `BANNER_COMBINATION_*` reason codes to each person in a
 * banner combination when the manager/player pairs have no
 * temporal overlap at the article date.
 */
function annotateCombinationOverlap(
  results: readonly EligibilityResult[],
  input: BannerCombinationInput,
): readonly EligibilityResult[] {
  if (results.length < 2 || !input.roster) return results;
  const byRole = (role: PersonRole) => results.filter((r) => r.role === role);

  const managers = byRole("MANAGER");
  const others = results.filter((r) => r.role !== "MANAGER");

  let overlapIssues = false;
  for (const m of managers) {
    for (const o of others) {
      const mRel = m.teamId ? findRelationship(input.roster, m.personId, m.teamId) : null;
      const oRel = o.teamId ? findRelationship(input.roster, o.personId, o.teamId) : null;
      if (!mRel || !oRel) continue;
      if (!relationshipsOverlapAtDate(mRel, oRel, input.articleDate)) {
        overlapIssues = true;
        break;
      }
    }
    if (overlapIssues) break;
  }
  if (!overlapIssues) return results;

  return results.map((r) => ({
    ...r,
    reasons: [...r.reasons, "BANNER_COMBINATION_NO_TEMPORAL_OVERLAP" as EligibilityReason],
  }));
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function makeEligibleResult(
  person: BannerPersonContext,
  rel: PersonTeamRelationship,
  visualContext: VisualContext,
  reasons: readonly EligibilityReason[],
  currentVisual: VisualContext,
): EligibilityResult {
  return {
    eligible: true,
    decision: "ELIGIBLE",
    personId: person.personId,
    teamId: rel.teamId,
    role: rel.role,
    relationshipStatus: rel.status as RelationshipStatus,
    visualContext: currentVisual,
    reasons,
    verifiedAt: rel.verifiedAt,
    confidence: confidenceFor(rel, reasons),
  };
}

function makeNotEligibleResult(
  person: BannerPersonContext,
  rel: PersonTeamRelationship,
  visualContext: VisualContext,
  reasons: readonly EligibilityReason[],
): EligibilityResult {
  return {
    eligible: false,
    decision: "NOT_ELIGIBLE",
    personId: person.personId,
    teamId: rel.teamId,
    role: rel.role,
    relationshipStatus: rel.status as RelationshipStatus,
    visualContext,
    reasons,
    verifiedAt: rel.verifiedAt,
    confidence: 0.85,
  };
}

function makeReviewResult(
  person: BannerPersonContext,
  reasons: readonly EligibilityReason[],
  rel: PersonTeamRelationship | undefined,
  role: PersonRole | undefined,
): EligibilityResult {
  return {
    eligible: false,
    decision: "REQUIRES_REVIEW",
    personId: person.personId,
    teamId: rel?.teamId,
    role: rel?.role ?? role,
    relationshipStatus: rel?.status as RelationshipStatus | undefined,
    visualContext: visualContextFromRelationship(rel ?? null, "" /* fallback */),
    reasons,
    verifiedAt: rel?.verifiedAt,
    confidence: rel ? 0.5 : 0.1,
  };
}

function confidenceFor(
  rel: PersonTeamRelationship,
  reasons: readonly EligibilityReason[],
): number {
  if (reasons.includes("STALE_DATA")) return 0.6;
  if (reasons.includes("HISTORICAL_EXCEPTION")) return 0.9;
  if (reasons.includes("ACTIVE_AT_DATE")) return 1.0;
  if (reasons.includes("TRANSFER_CONFIRMED_NEW_CLUB")) return 0.95;
  if (reasons.includes("TRANSFER_PENDING_NO_NEW_CLUB")) return 0.85;
  if (reasons.includes("PROFILE_SUBJECT_CURRENT")) return 0.9;
  return 0.7;
}
