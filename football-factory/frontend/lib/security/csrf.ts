// Football Factory — CSRF check for cookie-authenticated state-changing
// routes (FIRST SLICE).
//
// Strategy:
//   1. If the request is authenticated via cookie (session), require
//      either:
//        a) Origin header present AND its host equals the site's host
//           (configured via NEXT_PUBLIC_SITE_URL); OR
//        b) Sec-Fetch-Site header present AND its value is one of
//           "same-origin" / "same-site".
//   2. Requests that carry the automation secret header (x-automation-secret)
//      are NOT subject to this CSRF check — they authenticate by
//      shared secret instead.
//
// This is intentionally narrow. It is NOT a CSRF token scheme. For
// production-grade CSRF defense, add a double-submit token in a later
// slice.

import "server-only";

const SITE_FETCH_OK = new Set(["same-origin", "same-site"]);

function siteOriginHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

export type CsrfCheckResult =
  | { ok: true }
  | { ok: false; reason: "no_origin" | "origin_mismatch" | "fetch_site_invalid" };

export function checkCsrf(request: Request): CsrfCheckResult {
  // Header `x-automation-secret` authenticates the call independently;
  // CSRF does not apply.
  if (request.headers.get("x-automation-secret")) {
    return { ok: true };
  }
  // Sec-Fetch-Site is the most reliable signal: a cross-site request
  // is rejected outright. same-origin / same-site / none (modern
  // browsers; old browsers omit it).
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return { ok: false, reason: "fetch_site_invalid" };
  }
  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return { ok: true };
  }
  // Fall back to Origin header comparison.
  const origin = request.headers.get("origin");
  const expectedHost = siteOriginHost();
  if (!origin) {
    // Same-origin requests from older browsers may omit Origin. If
    // we have NO expected host to compare against, accept; otherwise
    // require Origin.
    if (!expectedHost) return { ok: true };
    return { ok: false, reason: "no_origin" };
  }
  if (!expectedHost) {
    return { ok: false, reason: "no_origin" };
  }
  try {
    const host = new URL(origin).host;
    if (host === expectedHost) return { ok: true };
  } catch {
    /* fallthrough */
  }
  return { ok: false, reason: "origin_mismatch" };
}

export function csrfRejectResponse(r: Extract<CsrfCheckResult, { ok: false }>) {
  return new Response(
    JSON.stringify({ ok: false, error: "csrf_rejected", reason: r.reason }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}
