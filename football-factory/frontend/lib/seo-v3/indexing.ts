// Football Factory — SEO V3 Generic Indexing Policy (Wave A).
//
// ADVISORY ONLY. Does NOT emit metadata. The current
// `lib/seo-entity/service.ts::buildHubSeo` (which derives
// `robots: { index, follow }` from itemCount) and any
// per-page metadata remain authoritative.
//
// This module produces a structured decision that consumers can
// adopt later (e.g. to validate a candidate `indexable` flag).

export type IndexingReason =
  | "OK"
  | "BLOCKED"
  | "INVALID_CANONICAL"
  | "POLICY_NOINDEX"
  | "THIN";

export interface IndexingInput {
  /** Number of useful content units on the page (e.g. items, links, sections). */
  contentUnits?: number;
  /** Minimum threshold below which the page is considered "thin". Default 0 — no thin veto without an explicit threshold. */
  minContentUnits?: number;
  /** Operator-set hard block. When true, noindex,nofollow. */
  blocked?: boolean;
  /** True when the candidate canonical is well-formed. */
  canonicalValid?: boolean;
  /** Operator-set policy noindex flag. */
  indexable?: boolean;
}

export interface IndexingDecision {
  index: boolean;
  follow: boolean;
  robots: "index,follow" | "noindex,follow" | "noindex,nofollow";
  reason: IndexingReason;
  policyVersion: string;
}

/**
 * Produce an indexing decision. Pure; no I/O; never throws.
 * The decision is advisory — production metadata emission still
 * happens through `lib/seo/seo.ts` / `lib/seo-entity/service.ts`.
 */
export function indexingPolicy(input: IndexingInput = {}): IndexingDecision {
  const contentUnits = input.contentUnits ?? 0;
  const minContentUnits = input.minContentUnits ?? 0;
  const blocked = input.blocked === true;
  const canonicalValid = input.canonicalValid !== false;
  const indexable = input.indexable !== false;

  if (blocked) {
    return {
      index: false,
      follow: false,
      robots: "noindex,nofollow",
      reason: "BLOCKED",
      policyVersion: "1",
    };
  }
  if (!canonicalValid) {
    return {
      index: false,
      follow: true,
      robots: "noindex,follow",
      reason: "INVALID_CANONICAL",
      policyVersion: "1",
    };
  }
  if (!indexable) {
    return {
      index: false,
      follow: true,
      robots: "noindex,follow",
      reason: "POLICY_NOINDEX",
      policyVersion: "1",
    };
  }
  if (contentUnits < minContentUnits) {
    return {
      index: false,
      follow: true,
      robots: "noindex,follow",
      reason: "THIN",
      policyVersion: "1",
    };
  }
  return {
    index: true,
    follow: true,
    robots: "index,follow",
    reason: "OK",
    policyVersion: "1",
  };
}
