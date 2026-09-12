// Football Factory — Banner Person Selection (Image System).
//
// Pure selection logic over the freshness gate's output. NEVER:
//   - generates an image
//   - generates an AI prompt
//   - evaluates rights
//
// Rules implemented here:
//   - REQUIRES_REVIEW / NOT_ELIGIBLE: not auto-selected
//   - ELIGIBLE: kept
//   - Priority: explicit article subject > transfer subject >
//     other valid persons
//   - Multi-person limit: 1..3 (default 3, hard cap 3)
//   - Deterministic ordering: stable by personId after priority

import type {
  EligibilityDecision,
  EligibilityResult,
} from "../entity-freshness/types";
import type { ComposerCandidate } from "./types";

const HARD_MAX_PEOPLE = 3;
const DEFAULT_MAX_PEOPLE = 3;
const TRANSFER_NEWS = "TRANSFER_NEWS";

export interface PrioritizedCandidate {
  candidate: ComposerCandidate;
  result: EligibilityResult;
  /** Lower number = higher priority. */
  priority: number;
}

/**
 * Assign a priority bucket to an eligible candidate.
 *
 * 0 — explicit article subject
 * 1 — current manager (when article is explicitly about manager)
 * 2 — transfer subject (TRANSFER_CONFIRMED or TRANSFER_PENDING)
 * 3 — current player explicitly referenced
 * 4 — other valid related person
 */
function priorityFor(
  candidate: ComposerCandidate,
  result: EligibilityResult,
  articleType: string,
): number {
  if (candidate.articleSubject) return 0;
  // For articles explicitly about the manager, manager candidates
  // get bumped above transfer subjects.
  if (
    articleType === "PROFILE" &&
    candidate.role === "MANAGER" &&
    result.relationshipStatus === "ACTIVE"
  ) {
    return 1;
  }
  if (
    articleType === TRANSFER_NEWS &&
    (result.relationshipStatus === "TRANSFER_PENDING" ||
      result.relationshipStatus === "TRANSFER_CONFIRMED")
  ) {
    return 2;
  }
  if (
    candidate.role === "PLAYER" &&
    result.relationshipStatus === "ACTIVE"
  ) {
    return 3;
  }
  return 4;
}

/**
 * Filter eligibility results down to ELIGIBLE only. REQUIRES_REVIEW
 * and NOT_ELIGIBLE are NEVER auto-selected.
 */
export function filterEligible(
  results: readonly { candidate: ComposerCandidate; result: EligibilityResult }[],
): readonly { candidate: ComposerCandidate; result: EligibilityResult }[] {
  return results.filter(({ result }) => result.decision === ("ELIGIBLE" as EligibilityDecision));
}

/**
 * Sort eligible candidates by priority bucket, then by stable
 * personId lexical order. Returns the first `maxPeople` candidates
 * (1..3 inclusive).
 */
export function selectTopPeople(
  eligible: readonly { candidate: ComposerCandidate; result: EligibilityResult }[],
  maxPeople: number,
  articleType: string,
): readonly PrioritizedCandidate[] {
  const cap = clampMaxPeople(maxPeople);
  if (eligible.length === 0) return [];
  const prioritized: PrioritizedCandidate[] = eligible.map((e) => ({
    candidate: e.candidate,
    result: e.result,
    priority: priorityFor(e.candidate, e.result, articleType),
  }));
  // Stable sort: priority ASC, then personId ASC.
  prioritized.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.candidate.personId.localeCompare(b.candidate.personId);
  });
  return prioritized.slice(0, cap);
}

/**
 * Build the `excludedPeople` audit list from candidates the
 * composer considered but did not select (NOT_ELIGIBLE or
 * REQUIRES_REVIEW), preserving the caller's original order.
 */
export function buildExcludedList(
  candidates: readonly ComposerCandidate[],
  results: readonly EligibilityResult[],
): readonly { personId: string; displayName?: string; reasons: readonly string[] }[] {
  const byId = new Map<string, ComposerCandidate>();
  for (const c of candidates) byId.set(c.personId, c);
  return results
    .filter((r) => r.decision !== ("ELIGIBLE" as EligibilityDecision))
    .map((r) => ({
      personId: r.personId,
      displayName: byId.get(r.personId)?.displayName,
      reasons: r.reasons,
    }));
}

export function clampMaxPeople(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_MAX_PEOPLE;
  return Math.max(1, Math.min(HARD_MAX_PEOPLE, Math.floor(n)));
}
