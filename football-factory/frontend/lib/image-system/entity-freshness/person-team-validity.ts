// Football Factory — Person/Team Temporal Validity (Image System).
//
// Pure date-arithmetic helpers. No network, no rendering, no rights.
// Determines:
//   - whether a relationship is active at a given article date
//   - whether two relationships temporally overlap at that date
//   - what visual context (current/former/target/new) the
//     relationship implies for a banner

import type {
  PersonTeamRelationship,
  RelationshipStatus,
  VisualContext,
} from "./types";

/**
 * Maximum staleness window in days. If a record's `verifiedAt`
 * is older than this, callers can mark the result
 * `REQUIRES_REVIEW`. Configurable per caller; default 14 days.
 */
export const DEFAULT_MAX_STALENESS_DAYS = 14;

/**
 * Parse a date string (YYYY-MM-DD or full ISO) into a UTC midnight
 * timestamp. Returns NaN if unparseable.
 */
export function parseArticleDate(input: string): number {
  if (typeof input !== "string" || input.length === 0) return NaN;
  // Accept "YYYY-MM-DD" by parsing as a date-only UTC timestamp.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const t = Date.parse(`${input}T00:00:00Z`);
    return Number.isFinite(t) ? t : NaN;
  }
  const t = Date.parse(input);
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Whether a relationship is "active at" the given article date.
 *
 * Rules:
 *   - If relationship is missing/unknown → false.
 *   - status === "UNKNOWN" → false (do NOT guess).
 *   - status === "ACTIVE" / "LOAN" → true when the date is within
 *     [validFrom?, validTo?].
 *   - status === "TRANSFER_CONFIRMED" → true only if validFrom is
 *     defined and the date is on or after validFrom AND (validTo
 *     absent OR date <= validTo).
 *   - status === "TRANSFER_PENDING" → NOT active as a current
 *     member — transfer has not been confirmed/effective yet.
 *   - status === "INACTIVE" / "FREE_AGENT" → false.
 *
 * "Within window" means: (validFrom absent OR date >= validFrom)
 * AND (validTo absent OR date <= validTo).
 */
export function isActiveAt(
  rel: PersonTeamRelationship | null | undefined,
  articleDate: string,
): boolean {
  if (!rel) return false;
  const date = parseArticleDate(articleDate);
  if (!Number.isFinite(date)) return false;

  switch (rel.status) {
    case "UNKNOWN":
      return false;
    case "INACTIVE":
    case "FREE_AGENT":
      return false;
    case "TRANSFER_PENDING":
      // Not yet a current member.
      return false;
    case "TRANSFER_CONFIRMED":
    case "ACTIVE":
    case "LOAN": {
      if (rel.validFrom) {
        const from = parseArticleDate(rel.validFrom);
        if (!Number.isFinite(from) || date < from) return false;
      }
      if (rel.validTo) {
        const to = parseArticleDate(rel.validTo);
        if (!Number.isFinite(to) || date > to) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Whether the relationship has definitively ENDED before the
 * article date — i.e. validTo is set and date > validTo.
 */
export function isFormerAt(
  rel: PersonTeamRelationship | null | undefined,
  articleDate: string,
): boolean {
  if (!rel || !rel.validTo) return false;
  const date = parseArticleDate(articleDate);
  const to = parseArticleDate(rel.validTo);
  return Number.isFinite(date) && Number.isFinite(to) && date > to;
}

/**
 * Two relationships temporally overlap at the given date when
 * both are active at that date. Used to ensure banner
 * combinations (manager + player) are not mixed across eras.
 */
export function relationshipsOverlapAtDate(
  a: PersonTeamRelationship | null | undefined,
  b: PersonTeamRelationship | null | undefined,
  articleDate: string,
): boolean {
  return isActiveAt(a, articleDate) && isActiveAt(b, articleDate);
}

/**
 * Days between two ISO date strings (signed). Returns NaN if either
 * is unparseable.
 */
export function daysBetween(later: string, earlier: string): number {
  const a = parseArticleDate(later);
  const b = parseArticleDate(earlier);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return (a - b) / (1000 * 60 * 60 * 24);
}

/**
 * Whether `verifiedAt` is older than `maxDays` from the article
 * date. Returns true when stale (caller should mark
 * `REQUIRES_REVIEW`).
 */
export function isStale(
  rel: PersonTeamRelationship | null | undefined,
  articleDate: string,
  maxDays = DEFAULT_MAX_STALENESS_DAYS,
): boolean {
  if (!rel || !rel.verifiedAt) return true;
  const gap = daysBetween(articleDate, rel.verifiedAt);
  if (!Number.isFinite(gap)) return true;
  return gap > maxDays;
}

/**
 * Derive the visual context implied by a relationship at a given
 * date. Pure function.
 *
 *   ACTIVE / LOAN at date       -> CURRENT_CLUB
 *   TRANSFER_CONFIRMED at date  -> NEW_CLUB
 *   TRANSFER_PENDING            -> TARGET_CLUB (advisory only)
 *   isFormerAt(date)            -> FORMER_CLUB
 *   otherwise / unknown         -> FORMER_CLUB (safer default;
 *                                  caller should add reason code)
 */
export function visualContextFromRelationship(
  rel: PersonTeamRelationship | null | undefined,
  articleDate: string,
): VisualContext {
  if (!rel) return "FORMER_CLUB";
  if (rel.status === "TRANSFER_PENDING") return "TARGET_CLUB";
  if (isFormerAt(rel, articleDate)) return "FORMER_CLUB";
  if (rel.status === "TRANSFER_CONFIRMED" && isActiveAt(rel, articleDate)) {
    return "NEW_CLUB";
  }
  if (isActiveAt(rel, articleDate)) return "CURRENT_CLUB";
  return "FORMER_CLUB";
}

/**
 * Find the most specific active relationship for a person-team
 * pair within a roster snapshot. Returns the first ACTIVE / LOAN /
 * TRANSFER_CONFIRMED match; otherwise the most-recent verified
 * one; otherwise null.
 */
export function findRelationship(
  roster: readonly PersonTeamRelationship[] | undefined,
  personId: string,
  teamId: string,
): PersonTeamRelationship | null {
  if (!Array.isArray(roster) || roster.length === 0) return null;
  const matches = roster.filter(
    (r) => r.personId === personId && r.teamId === teamId,
  );
  if (matches.length === 0) return null;
  // Prefer records that look active at the latest known date.
  const sorted = [...matches].sort((a, b) => {
    const aV = a.verifiedAt ?? "";
    const bV = b.verifiedAt ?? "";
    return bV.localeCompare(aV);
  });
  return sorted[0] ?? null;
}
