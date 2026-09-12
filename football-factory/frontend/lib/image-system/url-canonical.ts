// Football Factory — Image URL Canonicalization (R2.1 Wave C).
//
// PURE URL NORMALIZATION. NEVER decides:
//   - license validity
//   - publication permission
//   - rights confirmation
//   - image render eligibility
//
// These remain authoritative in `lib/image-system/policy.ts`.
//
// The helper here is purely about producing a stable, comparable
// URL from a noisy input URL: lowercase host, strip fragment, drop
// common tracking params, normalize trivial trailing-slash, and
// accept only http/https schemes. Malformed input is reported via
// a typed result rather than thrown.

/**
 * Standard tracking parameters stripped from canonical URLs. These
 * are analytics / campaign tokens that change between visits and
 * carry no semantic meaning about the asset itself.
 *
 * All entries are matched case-insensitively.
 */
export const DEFAULT_TRACKING_PARAMS: readonly string[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "utm_brand",
  "utm_social",
  "utm_creative_format",
  "utm_marketing_tactic",
  "fbclid",
  "gclid",
  "gclsrc",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "dclid",
  "_hsenc",
  "_hsmi",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
  "ref_url",
  "src",
  "source",
] as const;

export type SafeHttpUrlResult =
  | { ok: true; url: string; droppedParams: readonly string[] }
  | { ok: false; reason: string };

/**
 * Options for `safeHttpUrl`.
 */
export interface SafeHttpUrlOptions {
  /**
   * Tracking parameters to strip. Defaults to `DEFAULT_TRACKING_PARAMS`.
   * Pass an empty array to preserve all query params.
   */
  trackingParams?: readonly string[];

  /**
   * Whether to normalize the path's trailing slash. Default: true.
   * When true, a non-root path with a trailing slash keeps it
   * (no-op), and a non-root path without a trailing slash keeps it
   * (no-op). Only the empty path "/" is normalized; intermediate
   * trailing-slash stripping is intentionally avoided because it
   * can change the meaning of an image source URL.
   */
  normalizeTrailingSlash?: boolean;
}

/**
 * Parse and normalize an HTTP/HTTPS URL. Never throws.
 *
 * Accepts:
 *   - http: and https: schemes
 * Rejects:
 *   - javascript:, data:, file:, ftp:, blob:, vbscript:, ws:, wss:,
 *     or any other non-http(s) scheme
 *   - malformed URLs that the WHATWG URL parser rejects
 *
 * Normalizations applied:
 *   - lowercase scheme + host (preserving path casing, which can
 *     matter for case-sensitive asset hosts)
 *   - strip URL fragment ("#...")
 *   - drop common tracking query params (configurable)
 *   - leave the path alone by default (avoids accidental merging)
 *   - leave all non-tracking query params untouched
 */
export function safeHttpUrl(
  raw: string | null | undefined,
  options: SafeHttpUrlOptions = {},
): SafeHttpUrlResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "EMPTY_INPUT" };
  }
  // Reject obviously hostile or non-http schemes before URL parsing.
  // URL parser would happily turn `javascript:alert(1)` into a
  // valid URL with protocol "javascript:" — we refuse it explicitly.
  const trimmed = raw.trim();
  const schemeMatch = /^[a-z][a-z0-9+.\-]*:/i.exec(trimmed);
  if (!schemeMatch) {
    return { ok: false, reason: "MISSING_SCHEME" };
  }
  const scheme = schemeMatch[0].slice(0, -1).toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    return { ok: false, reason: `FORBIDDEN_SCHEME:${scheme}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "MALFORMED_URL" };
  }

  // Additional defense-in-depth: confirm parsed protocol is http(s).
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `FORBIDDEN_SCHEME:${parsed.protocol.replace(":", "")}` };
  }

  // Lowercase host. Path case is preserved intentionally — many
  // asset hosts are case-sensitive and collapsing case there would
  // merge distinct assets.
  parsed.hostname = parsed.hostname.toLowerCase();

  // Strip fragment.
  parsed.hash = "";

  // Optional trailing-slash normalization. Default no-op for
  // non-root paths. Only "/" is preserved as-is.
  if (options.normalizeTrailingSlash !== false) {
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/") && parsed.pathname.length > 1) {
      // Strip a single trailing slash if it doesn't affect path
      // identity. We don't recursively normalize "//" or ".." —
      // those would change semantics.
      const last = parsed.pathname.slice(0, -1);
      if (last.length > 0 && last !== "/") {
        parsed.pathname = last;
      }
    }
  }

  // Drop tracking params. Compare keys case-insensitively.
  const tracking = new Set(
    (options.trackingParams ?? DEFAULT_TRACKING_PARAMS).map((p) => p.toLowerCase()),
  );
  const droppedParams: string[] = [];
  if (Array.from(parsed.searchParams.keys()).length > 0) {
    const keep: string[] = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      if (tracking.has(key.toLowerCase())) {
        if (!droppedParams.includes(key)) droppedParams.push(key);
        continue;
      }
      keep.push(`${key}=${value}`);
    }
    if (droppedParams.length > 0) {
      // Reconstruct query string preserving order of first appearance.
      parsed.search = keep.length > 0 ? `?${keep.join("&")}` : "";
    }
  }

  // Strip default ports.
  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  return {
    ok: true,
    url: parsed.toString(),
    droppedParams,
  };
}
