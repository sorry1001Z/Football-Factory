// Football Factory — SEO V3 Generic Canonical Validator (Wave A).
//
// ADVISORY / VALIDATION ONLY. Does NOT replace `lib/seo/seo.ts::buildCanonical`.
// The current production renderer remains the authoritative source of
// `<link rel="canonical">` on every page.
//
// This module ports the SEO Engine V3 R2 canonical.mjs to TypeScript
// and exposes a strict typed result so the production renderer can
// later validate candidates before adopting them.
//
// Contract:
//   - same-origin by default (canonical candidate must share host
//     with the site origin).
//   - external host allowed ONLY if `allowedHosts` includes it AND
//     `allowExternal: true` is passed. `allowExternal: true` alone
//     does NOT permit arbitrary external hosts.
//   - rejects `javascript:`, `data:`, `file:` and any other non
//     `http(s)` protocol.
//   - strips query and hash from the canonical.
//   - normalises duplicate slashes and trailing slashes.

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

export type CanonicalReason =
  | "OK"
  | "INVALID_ORIGIN_PROTOCOL"
  | "INVALID_URL"
  | "DISALLOWED_PROTOCOL"
  | "CROSS_ORIGIN"
  | "EMPTY_INPUT";

export interface CanonicalOk {
  ok: true;
  url: string;
  reason: Extract<CanonicalReason, "OK">;
}

export interface CanonicalErr {
  ok: false;
  reason: Exclude<CanonicalReason, "OK">;
}

export type CanonicalResult = CanonicalOk | CanonicalErr;

export interface CanonicalOptions {
  /**
   * If `true`, candidates whose host differs from the site origin
   * are permitted ONLY when their host appears in `allowedHosts`.
   * `allowExternal: true` alone does NOT open arbitrary external
   * canonicals — the explicit whitelist is always required.
   */
  allowExternal?: boolean;
  /**
   * Whitelist of external hosts permitted when `allowExternal` is
   * true. Compared case-insensitively against the candidate host.
   */
  allowedHosts?: readonly string[];
}

/**
 * Validate a candidate canonical URL. Returns a discriminated
 * result. Pure; no I/O; never throws.
 */
export function validateCanonical(
  siteOrigin: string,
  input: string | null | undefined,
  options: CanonicalOptions = {},
): CanonicalResult {
  const allowExternal = options.allowExternal === true;
  const allowedHosts = (options.allowedHosts ?? []).map((h) => h.toLowerCase());

  // 1. Validate site origin protocol.
  let base: URL;
  try {
    base = new URL(siteOrigin);
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }
  if (!ALLOWED_PROTOCOLS.has(base.protocol)) {
    return { ok: false, reason: "INVALID_ORIGIN_PROTOCOL" };
  }

  // 2. Treat empty / null / undefined as a soft failure (NOT_OK).
  //    We don't reject; we just refuse to normalise.
  if (input === null || input === undefined) {
    return { ok: false, reason: "EMPTY_INPUT" };
  }
  const raw = String(input).trim();
  if (raw.length === 0) {
    return { ok: false, reason: "EMPTY_INPUT" };
  }

  // 3. Reject known dangerous protocols (case-insensitive prefix
  //    match against the raw string).
  if (/^(javascript|data|file):/i.test(raw)) {
    return { ok: false, reason: "DISALLOWED_PROTOCOL" };
  }

  // 4. Parse via URL constructor. If parsing fails, refuse.
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }

  // 5. Final protocol gate (in case the raw had a sneaky prefix
  //    that the URL parser normalised).
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    return { ok: false, reason: "DISALLOWED_PROTOCOL" };
  }

  // 6. Host comparison (case-insensitive).
  const baseHost = base.hostname.toLowerCase();
  const host = u.hostname.toLowerCase();
  const hostAllowed =
    host === baseHost || allowedHosts.includes(host);
  if (!allowExternal && !hostAllowed) {
    return { ok: false, reason: "CROSS_ORIGIN" };
  }
  if (allowExternal && !hostAllowed) {
    // allowExternal without explicit whitelist = same-origin only.
    return { ok: false, reason: "CROSS_ORIGIN" };
  }

  // 7. Normalise.
  u.hostname = host;
  u.search = "";
  u.hash = "";
  // Collapse duplicate slashes inside the path, but keep the
  // leading "//". Then strip a trailing slash EXCEPT for the root.
  const collapsed = u.pathname.replace(/\/{2,}/g, "/");
  u.pathname = collapsed.replace(/\/$/, "") || "/";

  return { ok: true, url: u.toString(), reason: "OK" };
}

/**
 * Convenience: returns the normalised URL string, or `null` on
 * failure. Production callers that just need the cleaned URL
 * should prefer the discriminated result above.
 */
export function tryCanonical(
  siteOrigin: string,
  input: string | null | undefined,
  options?: CanonicalOptions,
): string | null {
  const r = validateCanonical(siteOrigin, input, options);
  return r.ok ? r.url : null;
}
