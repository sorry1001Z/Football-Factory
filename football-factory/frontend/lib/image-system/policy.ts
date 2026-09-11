// Football Factory — Image System policy helpers (R2 Wave 1).
//
// Adapted from the external Football Image System R2 pack (src/policy.ts)
// with one CRITICAL SAFETY CORRECTION:
//
//   canDownloadBinary()  — in the original R2 source code, this function
//   could return `true` based on a permissive fallback whenever an asset
//   carried any license string AND the source allowed download. That
//   fallback bypassed the explicit `publicationDecision()` check.
//
//   We tighten the contract: callers MUST have already passed
//   `publicationDecision(source, asset).ok === true` before downloading.
//   This module exports `canDownloadBinary(source, asset, opts)` where
//   `opts.requirePublicationDecision` is REQUIRED and defaults to true.
//
// All other helpers (canUseSource, requiresPerAssetCheck,
// requiresAttribution, canCacheMetadata, publicationDecision) match the
// audited R2 semantics unchanged.

import type {
  Asset,
  PublicationDecisionResult,
  PublicationReason,
  SourcePolicy,
} from "./types";

export const canUseSource = (s: SourcePolicy): boolean =>
  s.status !== "BLOCKED" && s.commercial_use_allowed && s.editorial_use_allowed;

export const requiresPerAssetCheck = (s: SourcePolicy): boolean =>
  s.status === "CHECK_PER_ASSET";

export const requiresAttribution = (
  s: SourcePolicy,
  a?: Asset,
): boolean => {
  if (s.attribution_required) return true;
  if (a?.license && /CC BY/i.test(a.license)) return true;
  return false;
};

export const canCacheMetadata = (s: SourcePolicy): boolean =>
  s.status !== "BLOCKED" && s.metadata_cache_ttl_hours > 0;

/**
 * Decision function. Returns ok:true ONLY when:
 *   - source is not BLOCKED
 *   - if CHECK_PER_ASSET, asset has both license and license_url
 *   - asset state is not QUARANTINED_*
 */
export function publicationDecision(
  s: SourcePolicy,
  a: Asset,
): PublicationDecisionResult {
  if (!canUseSource(s)) return { ok: false, reason: "blocked-source" };
  if (requiresPerAssetCheck(s) && (!a.license || !a.license_url)) {
    return { ok: false, reason: "rights-unresolved" };
  }
  if (a.state.startsWith("QUARANTINED")) {
    return { ok: false, reason: a.state as PublicationReason };
  }
  return { ok: true, reason: "verified-metadata-present" };
}

/**
 * BINARY DOWNLOAD GATE (HARDENED).
 *
 * IMPORTANT: This function is intentionally HARDER to call than the
 * upstream R2 pack's version. The R2 version returned true based on
 * `Boolean(a?.license && s.download_allowed)` as a fallback whenever
 * `canUseSource() && s.download_allowed && !requiresPerAssetCheck(s)`
 * was false. That fallback allowed a binary download whenever a license
 * string was present, even if `publicationDecision()` would have
 * refused it. We close that loophole.
 *
 * To use this function, the caller MUST pass
 * `{ requirePublicationDecision: publicationDecisionResult }` where
 * `publicationDecisionResult.ok === true`. Without it, the function
 * returns false unconditionally.
 */
export interface CanDownloadBinaryOptions {
  /**
   * The precomputed publicationDecision result. Required. This makes
   * the safety dependency explicit at every call site.
   */
  requirePublicationDecision: PublicationDecisionResult;
}

export function canDownloadBinary(
  s: SourcePolicy,
  a: Asset,
  opts: CanDownloadBinaryOptions,
): boolean {
  if (!opts?.requirePublicationDecision) return false;
  if (opts.requirePublicationDecision.ok !== true) return false;
  if (!canUseSource(s)) return false;
  if (!s.download_allowed) return false;
  // Even with publicationDecision OK, require that the asset has both
  // license and license_url before allowing the binary download. This
  // is belt-and-suspenders with the decision function, but it's the
  // last layer that protects against an asset record that has been
  // hand-edited past the policy layer.
  if (!a.license || !a.license_url) return false;
  return true;
}
