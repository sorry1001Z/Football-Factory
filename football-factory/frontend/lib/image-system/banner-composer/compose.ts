// Football Factory — Banner Composer (Image System).
//
// Pure advisory composer. Returns BannerComposition metadata.
// NEVER:
//   - generates an image
//   - generates an AI prompt
//   - evaluates rights
//   - mutates the input
//
// Reuses the entity-freshness gate's evaluator — does NOT
// duplicate the freshness logic.

import {
  evaluateBannerCombination,
  evaluateBannerPersonEligibility,
} from "../entity-freshness/banner-eligibility";
import type {
  ArticleType,
  BannerPersonContext,
  EligibilityResult,
  PersonTeamRelationship,
  VisualContext,
} from "../entity-freshness/types";
import {
  buildExcludedList,
  clampMaxPeople,
  filterEligible,
  selectTopPeople,
} from "./selection";
import type {
  BannerComposerInput,
  BannerComposition,
  BannerWarning,
  ComposerStatus,
  ComposerCandidate,
  ExcludedPerson,
  LayoutSuggestion,
} from "./types";

/**
 * Compose banner metadata. Pure function. Does NOT render.
 *
 * Step-by-step:
 *   1. Evaluate every candidate via the freshness gate.
 *   2. Filter to ELIGIBLE only (REQUIRES_REVIEW / NOT_ELIGIBLE
 *      are never auto-selected).
 *   3. Apply deterministic priority + stable lexical ordering.
 *   4. Slice to maxPeople (default 3, hard cap 3).
 *   5. Detect combination overlap warnings (manager/player).
 *   6. Detect transfer / former / review warnings.
 *   7. Compute layout suggestion from selected people.
 *   8. Compute confidence (mean of selected people).
 *   9. Return NO_VALID_SUBJECTS when zero selected.
 */
export function composeBanner(input: BannerComposerInput): BannerComposition {
  // Defensive copy — composer MUST NOT mutate the input.
  const candidates = input.people.slice();

  // For each candidate, build the effective roster the freshness
  // gate will see. When the caller provides a candidate-specific
  // `relationship`, that record overrides any roster entry with
  // the same (personId, teamId) — the candidate's relationship is
  // the authoritative source for that person. Other roster entries
  // pass through unchanged.
  const allResults: EligibilityResult[] = candidates.map((c) => {
    const effectiveRoster = effectiveRosterFor(c, input.roster);
    return evaluateBannerPersonEligibility({
      person: candidateToContext(c, input.articleDate, input.teamIds),
      articleType: input.articleType,
      articleDate: input.articleDate,
      teamIds: input.teamIds,
      roster: effectiveRoster,
      maxStalenessDays: input.maxStalenessDays,
    });
  });

  // Build candidate → result pairs (preserves caller order).
  const paired = candidates.map((candidate, i) => {
    const result = allResults[i];
    if (!result) {
      throw new Error("composer: missing result for candidate (internal bug)");
    }
    return { candidate, result };
  });

  // Filter & select.
  const eligible = filterEligible(paired);
  const max = clampMaxPeople(input.maxPeople);
  const selected = selectTopPeople(eligible, max, input.articleType);

  // Build BannerPersonContext records for selected people.
  const selectedPeople: BannerPersonContext[] = selected.map((p) =>
    candidateToContext(p.candidate, input.articleDate, input.teamIds, p.result),
  );

  // Build excluded list (NOT_ELIGIBLE / REQUIRES_REVIEW).
  const excludedPeople: readonly ExcludedPerson[] = buildExcludedList(
    candidates,
    allResults,
  );

  // Combination-level re-evaluation for manager/player overlap.
  const combination = evaluateBannerCombination({
    articleType: input.articleType,
    articleDate: input.articleDate,
    teamIds: input.teamIds,
    people: selectedPeople,
    roster: input.roster,
  });

  // Detect warnings.
  const warnings = detectWarnings({
    selected,
    combination,
    articleType: input.articleType,
  });

  // Status.
  const hasReview = selected.some(
    (s) => s.result.decision === "REQUIRES_REVIEW",
  );
  const status: ComposerStatus =
    selectedPeople.length === 0
      ? "NO_VALID_SUBJECTS"
      : hasReview || warnings.length > 0
        ? "REQUIRES_REVIEW"
        : "READY";

  // Layout suggestion.
  const layoutSuggestion = suggestLayout({
    selectedCount: selectedPeople.length,
    articleType: input.articleType,
    warnings,
  });

  // Confidence (mean of selected; 0 when none).
  const confidence =
    selectedPeople.length === 0
      ? 0
      : selectedPeople.reduce((s, _p, i) => s + (selected[i]?.result.confidence ?? 0), 0) /
        selectedPeople.length;

  return {
    status,
    selectedPeople,
    excludedPeople,
    teamIds: input.teamIds ?? [],
    competitionIds: input.competitionIds ?? [],
    layoutSuggestion,
    warnings,
    confidence,
    audit: allResults,
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Build the effective roster the freshness gate will evaluate
 * against. When the candidate supplies its own `relationship`,
 * that record replaces any roster entry for the same
 * (personId, teamId) pair. Other entries pass through.
 */
function effectiveRosterFor(
  candidate: ComposerCandidate,
  roster: readonly PersonTeamRelationship[] | undefined,
): readonly PersonTeamRelationship[] | undefined {
  if (!candidate.relationship) return roster;
  if (!Array.isArray(roster) || roster.length === 0) {
    return [candidate.relationship];
  }
  const rel = candidate.relationship;
  const filtered = roster.filter(
    (r) => !(r.personId === rel.personId && r.teamId === rel.teamId),
  );
  return [...filtered, rel];
}

function candidateToContext(
  candidate: ComposerCandidate,
  articleDate: string,
  teamIds: readonly string[] | undefined,
  eligibility?: EligibilityResult,
): BannerPersonContext {
  const currentTeamId =
    candidate.relationship?.teamId ?? teamIds?.[0] ?? undefined;
  // Visual context comes from the eligibility result when present
  // (so we preserve the freshness gate's classification); otherwise
  // we default to CURRENT_CLUB and let the gate refine it.
  const visualContext: VisualContext =
    eligibility?.visualContext ?? "CURRENT_CLUB";
  return {
    personId: candidate.personId,
    displayName: candidate.displayName,
    role: candidate.role,
    currentTeamId,
    visualContext,
    articleDate,
  };
}

function detectWarnings(args: {
  selected: readonly { candidate: ComposerCandidate; result: EligibilityResult }[];
  combination: readonly EligibilityResult[];
  articleType: ArticleType;
}): readonly BannerWarning[] {
  const warnings: BannerWarning[] = [];

  // Combination-level overlap warning (already on each result).
  for (const r of args.combination) {
    if (
      r.reasons.includes("BANNER_COMBINATION_NO_TEMPORAL_OVERLAP" as never)
    ) {
      if (!warnings.includes("MIXED_FORMER_AND_CURRENT")) {
        warnings.push("MIXED_FORMER_AND_CURRENT");
      }
    }
  }

  // Transfer warnings. A candidate is "transfer-active" when the
  // relationship is TRANSFER_PENDING or TRANSFER_CONFIRMED.
  for (const { candidate, result } of args.selected) {
    const isTransferPending = result.relationshipStatus === "TRANSFER_PENDING";
    const isTransferConfirmed = result.relationshipStatus === "TRANSFER_CONFIRMED";

    // Pending transfer + selected as current player: warn the
    // renderer NOT to imply new-club membership.
    if (isTransferPending) {
      if (!warnings.includes("TRANSFER_PENDING_DO_NOT_IMPLY_NEW_CLUB")) {
        warnings.push("TRANSFER_PENDING_DO_NOT_IMPLY_NEW_CLUB");
      }
    }

    // Confirmed transfer where the player has not yet joined the
    // new club on the article date (we still treat them as
    // CURRENT_CLUB visually): warn the renderer that the new-club
    // context is not yet effective.
    if (
      isTransferConfirmed &&
      result.visualContext !== "NEW_CLUB"
    ) {
      if (!warnings.includes("TRANSFER_CONFIRMED_BEFORE_EFFECTIVE_DATE")) {
        warnings.push("TRANSFER_CONFIRMED_BEFORE_EFFECTIVE_DATE");
      }
    }
    // Suppress unused-variable lint.
    void candidate;
  }

  // Mixed former + current (current-news banner only).
  if (args.articleType === "CURRENT_NEWS" || args.articleType === "MATCH_NEWS") {
    const hasFormer = args.selected.some(
      (s) => s.result.visualContext === "FORMER_CLUB",
    );
    const hasCurrent = args.selected.some(
      (s) => s.result.visualContext === "CURRENT_CLUB",
    );
    if (hasFormer && hasCurrent && !warnings.includes("MIXED_FORMER_AND_CURRENT")) {
      warnings.push("MIXED_FORMER_AND_CURRENT");
    }
  }

  // Include review status when the freshness gate couldn't decide.
  if (args.selected.some((s) => s.result.decision === "REQUIRES_REVIEW")) {
    if (!warnings.includes("REQUIRES_REVIEW_INCLUDED")) {
      warnings.push("REQUIRES_REVIEW_INCLUDED");
    }
  }

  // When we'd otherwise return NO_VALID_SUBJECTS, suggest generic fallback.
  if (args.selected.length === 0) {
    if (!warnings.includes("GENERIC_FALLBACK_RECOMMENDED")) {
      warnings.push("GENERIC_FALLBACK_RECOMMENDED");
    }
  }

  return warnings;
}

function suggestLayout(args: {
  selectedCount: number;
  articleType: ArticleType;
  warnings: readonly BannerWarning[];
}): LayoutSuggestion {
  if (args.selectedCount === 0) return "GENERIC_TEAM";
  if (args.articleType === "HISTORICAL") return "HISTORICAL";
  if (
    args.warnings.includes("TRANSFER_PENDING_DO_NOT_IMPLY_NEW_CLUB") ||
    args.warnings.includes("TRANSFER_CONFIRMED_BEFORE_EFFECTIVE_DATE")
  ) {
    return "TRANSFER_SPLIT";
  }
  if (args.selectedCount === 1) return "SINGLE_SUBJECT";
  if (args.selectedCount === 2) return "DUAL_SUBJECT";
  return "TRIPLE_SUBJECT";
}
