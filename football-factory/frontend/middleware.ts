import { NextResponse, type NextRequest } from "next/server";

/**
 * Football Factory — security middleware.
 *
 * Responsibilities (this slice):
 *   - Inject `Content-Security-Policy-Report-Only` header on every
 *     response. We intentionally stay in REPORT-ONLY mode until we
 *     have proven via the violation stream that no production page
 *     depends on something missing from the policy.
 *   - Do NOT enforce CSP yet — enforcement is deferred to a future
 *     slice after manual review of the report stream.
 *
 * What the policy covers:
 *   - default-src 'self'                              limit everything by default
 *   - script-src 'self' 'unsafe-inline' 'unsafe-eval' Next.js + Vercel Live + dev tools
 *   - style-src 'self' 'unsafe-inline'                Next.js often injects styles
 *   - img-src 'self' https://wp.ff90.online data:     allow wp uploads + data URLs
 *   - font-src 'self' data:                           allow local + data URI fonts
 *   - connect-src 'self' https://wp.ff90.online       frontend ↔ WordPress REST/GraphQL
 *   - frame-ancestors 'none'                          no embedding
 *   - base-uri 'self'                                 block <base href> injection
 *   - form-action 'self'                              block off-site form submissions
 *
 * What we KNOW is in production dependencies:
 *   - https://vercel.live  (Vercel toolbar; not active on prod by default)
 *   - https://wp.ff90.online  (WordPress REST + GraphQL backend)
 *
 * What we did NOT need and did not include:
 *   - https://graphql.ff90.online — this host is not used; the
 *     production graphql endpoint lives on the WordPress domain.
 *   - analytics scripts (none currently wired per FF90 architecture).
 *   - image hosts beyond `self` and `wp.ff90.online` — football
 *     provider responses are JSON, not images.
 */

const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://wp.ff90.online data: blob:",
  "font-src 'self' data:",
  // Connect allows browser-side fetches from the SPA. Server-side
  // routes (Node `fetch`) are not governed by CSP.
  "connect-src 'self' https://wp.ff90.online https://ff90.online https://www.ff90.online",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export function middleware(request: NextRequest) {
  // Use NextResponse.next() with explicit response headers. Modifying
  // REQUEST headers would only forward to downstream handlers; the CSP
  // response header MUST be set on the response object to reach the
  // browser.
  const response = NextResponse.next();

  // Defensive: strip X-Powered-By if it slipped through next.config.
  response.headers.delete("x-powered-by");
  // Set CSP report-only (we do NOT enforce yet).
  response.headers.set("Content-Security-Policy-Report-Only", cspReportOnly);

  return response;
}

/**
 * Match every path EXCEPT static assets and Next.js internals. Static
 * assets should not carry CSP — they are not the document context.
 * Everything else does.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     *   - api/health (cheap probe — do not pay CSP overhead)
     *   - api/automation/* (server endpoints — CSP applies on the
     *     HTML pages that call them, not on the server responses)
     *   - _next/static, _next/image (served assets)
     *   - favicon.ico, robots.txt, sitemap.xml
     */
    "/((?!api/health|api/automation|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
