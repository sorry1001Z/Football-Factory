// Football Factory — Image Candidate Deduplication (R2.1 Wave C).
//
// PURE CANDIDATE DEDUPLICATION. NEVER decides:
//   - license validity
//   - publication permission
//   - rights confirmation
//   - image render eligibility
//
// The helpers here produce a stable identity for an image
// candidate and deterministically dedupe a candidate list by that
// identity. The candidate's existing metadata is preserved; only
// duplicates are merged, and the deterministic tie-break prefers
// the most-complete / newest-valid candidate.
//
// If `canonicalIdentity` cannot be produced for a candidate, that
// candidate is preserved in the output untouched — never silently
// dropped.

import { safeHttpUrl, type SafeHttpUrlResult } from "./url-canonical";

/**
 * Minimal contract an ImageCandidate must satisfy. The real type
 * lives in `lib/image-system/types.ts`; this interface matches the
 * fields dedupe needs without taking a hard import.
 */
export interface DedupCandidateLike {
  /** Stable source identifier (e.g. "wikipedia", "team-logo"). */
  source?: string | null;
  /** Original source URL (page or asset, will be normalized). */
  sourceUrl?: string | null;
  /** Image URL (will be normalized). */
  imageUrl?: string | null;
  /** Optional ISO timestamp when the asset was verified. */
  verifiedAt?: string | null;
  /**
   * Optional metadata completeness score. Higher = more complete.
   * Used as the first tie-break when two candidates share the
   * same canonical identity. When omitted, we compute a rough
   * score from non-empty fields.
   */
  completeness?: number | null;
  /** Any other fields on the candidate are preserved as-is. */
  [k: string]: unknown;
}

export interface CanonicalIdentity {
  source: string;
  /**
   * Normalized source URL. May be null when the source URL is
   * absent or cannot be normalized. In that case the identity
   * degrades to `{ source, imageKey }`.
   */
  sourceUrl: string | null;
  /**
   * Normalized image URL, OR the raw imageUrl when normalization
   * failed (so that malformed-but-present URLs still get a
   * stable identity distinct from "no imageUrl").
   */
  imageKey: string;
}

export type CanonicalIdentityResult =
  | { ok: true; identity: CanonicalIdentity }
  | { ok: false; reason: string };

/**
 * Build a stable canonical identity for an image candidate.
 *
 * Components:
 *   - source name (lower-cased, trimmed, fallback "unknown")
 *   - normalized source URL (when parseable as http(s))
 *   - normalized image URL (when parseable as http(s))
 *
 * If the imageUrl cannot be normalized but is non-empty, the
 * raw imageUrl is used as imageKey so distinct malformed URLs
 * still produce distinct identities. If imageUrl is empty AND
 * sourceUrl cannot be normalized, the identity cannot be
 * produced (returns `{ ok: false }`).
 *
 * The function never throws. It treats any input field as
 * optional and validates at the edge.
 */
export function canonicalIdentity(
  candidate: DedupCandidateLike | null | undefined,
): CanonicalIdentityResult {
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, reason: "INVALID_CANDIDATE" };
  }

  const source = typeof candidate.source === "string" && candidate.source.trim().length > 0
    ? candidate.source.trim().toLowerCase()
    : "unknown";

  const sourceUrlResult = typeof candidate.sourceUrl === "string"
    ? safeHttpUrl(candidate.sourceUrl, { normalizeTrailingSlash: false })
    : null;
  const sourceUrl = sourceUrlResult?.ok ? sourceUrlResult.url : null;

  const imageUrlResult = typeof candidate.imageUrl === "string"
    ? safeHttpUrl(candidate.imageUrl, { normalizeTrailingSlash: false })
    : null;

  let imageKey: string;
  if (imageUrlResult?.ok) {
    imageKey = imageUrlResult.url;
  } else if (typeof candidate.imageUrl === "string" && candidate.imageUrl.trim().length > 0) {
    imageKey = `raw:${candidate.imageUrl.trim()}`;
  } else {
    // We have nothing useful to identify the image. The identity
    // cannot be produced — dedupe will preserve this candidate as-is.
    return { ok: false, reason: "NO_IMAGE_URL" };
  }

  return {
    ok: true,
    identity: {
      source,
      sourceUrl,
      imageKey,
    },
  };
}

/**
 * Tie-break score for selecting the best duplicate. Higher wins.
 *
 * Components (in order):
 *   1. Explicit `completeness` field (if provided as a finite number)
 *   2. Number of non-empty primitive fields on the candidate
 *   3. Newer valid `verifiedAt` timestamp (when parseable)
 *   4. Stable lexical order of the identity's `imageKey` (tie-breaker)
 */
function candidateScore(candidate: DedupCandidateLike, identityKey: string): number {
  let score = 0;

  // 1. Explicit completeness.
  if (typeof candidate.completeness === "number" && Number.isFinite(candidate.completeness)) {
    score += candidate.completeness * 1_000_000;
  }

  // 2. Number of non-empty fields. Counts truthy primitives + non-empty strings.
  for (const v of Object.values(candidate)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.length === 0) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      score += 1;
    } else if (Array.isArray(v)) {
      score += 1;
    }
  }

  // 3. Newer verifiedAt wins. Convert to a millisecond offset
  // relative to year 2000 so the time contribution stays small
  // relative to the field-count contribution.
  if (typeof candidate.verifiedAt === "string" && candidate.verifiedAt.length > 0) {
    const t = Date.parse(candidate.verifiedAt);
    if (Number.isFinite(t)) {
      const offsetMs = t - Date.UTC(2000, 0, 1);
      if (offsetMs > 0) score += Math.min(offsetMs / 1_000, 1_000_000);
    }
  }

  // 4. Tie-breaker via the identity's imageKey lexical order.
  // Add a tiny fractional score derived from a stable hash so
  // that equal scores still resolve deterministically.
  score += stableHashFraction(identityKey);

  return score;
}

/**
 * Stable, deterministic, no-Math.random micro-hash. Returns a
 * fractional value in [0, 1). Good enough for a tie-breaker.
 */
function stableHashFraction(s: string): number {
  // FNV-1a 32-bit over the input. Deterministic across runs.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Map unsigned 32-bit to [0, 1).
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * A version of canonicalIdentity used internally for dedupe that
 * always returns a usable string key. When canonicalIdentity
 * cannot be produced, returns a per-candidate unique sentinel
 * ("__unkeyed:N") so dedupe preserves each unkeyed candidate
 * individually rather than merging them.
 */
function identityKeyForDedup(
  candidate: DedupCandidateLike,
  index: number,
): { key: string; ok: boolean } {
  const r = canonicalIdentity(candidate);
  if (r.ok) return { key: `${r.identity.source}|${r.identity.sourceUrl ?? ""}|${r.identity.imageKey}`, ok: true };
  return { key: `__unkeyed:${index}`, ok: false };
}

/**
 * Deduplicate a list of image candidates by canonical identity.
 *
 * Rules:
 *   - PURE function: does not mutate the input array.
 *   - DETERMINISTIC: same input → same output, in stable order.
 *   - When multiple candidates share a canonical identity, the
 *     "best" one (per the deterministic tie-break in
 *     `candidateScore`) is kept; the rest are dropped.
 *   - Candidates that cannot be keyed are PRESERVED as-is, in
 *     input order, never silently dropped.
 *   - Output order: kept duplicates preserve the input order of
 *     the winning candidate. Unkeyed candidates are appended in
 *     input order after the keyed ones.
 *
 * NO rights / license / publication decision is made here.
 */
export function dedupeCandidates<T extends DedupCandidateLike>(
  input: readonly T[],
): T[] {
  if (!Array.isArray(input) || input.length === 0) return [];

  const keyed = new Map<string, { candidate: T; index: number; score: number }>();
  const unkeyed: Array<{ candidate: T; index: number }> = [];

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const { key, ok } = identityKeyForDedup(c, i);
    if (!ok) {
      unkeyed.push({ candidate: c, index: i });
      continue;
    }
    const score = candidateScore(c, key);
    const existing = keyed.get(key);
    if (!existing || score > existing.score) {
      keyed.set(key, { candidate: c, index: i, score });
    }
  }

  // Emit keyed candidates in the order their WINNING copy appeared
  // in the input. This keeps output stable.
  const keyedEntries = Array.from(keyed.values()).sort((a, b) => a.index - b.index);
  const out: T[] = [];
  for (const e of keyedEntries) out.push(e.candidate);
  for (const e of unkeyed.sort((a, b) => a.index - b.index)) out.push(e.candidate);

  return out;
}

/**
 * Re-export of `safeHttpUrl` so consumers that import only from
 * `dedupe.ts` can still access URL normalization without a
 * separate import path.
 */
export { safeHttpUrl };
export type { SafeHttpUrlResult };
