// Football Factory — admin guard (FIRST SLICE).
//
// Reads the session cookie, verifies the HS256 JWT-like token, and
// enforces the allowed-role list. The result type is discriminated so
// callers can map directly to HTTP responses.
//
// Behavior:
//   - missing AUTH_SECRET or invalid/placeholder → 503 auth_secret_not_configured
//   - valid AUTH_SECRET + no cookie             → 401 unauthenticated
//   - valid AUTH_SECRET + bad/expired/tampered  → 401 invalid_session
//   - valid AUTH_SECRET + role not in allowlist → 403 forbidden
//   - valid AUTH_SECRET + role in allowlist     → ok:true (route proceeds)
//
// The guard is intentionally generic; `requireAdmin` and
// `requireAdminOrEditor` are thin wrappers for the common cases.

import "server-only";
import { readSessionCookie } from "@/lib/auth/cookie";
import { verifySessionToken } from "@/lib/auth/session";
import { ALL_ROLES, type Role, type Session } from "@/lib/auth/contracts";

export type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; status: 401; error: "unauthenticated" | "invalid_session" }
  | { ok: false; status: 403; error: "forbidden" }
  | { ok: false; status: 503; error: "auth_secret_not_configured" };

type SecretCheck =
  | { ok: true; secret: string }
  | { ok: false; reason: "missing" | "too_short" | "placeholder" };

/**
 * Non-throwing AUTH_SECRET lookup. Returns a discriminated result so
 * callers can map cleanly to a 503 response without ever throwing.
 * The brief requires us NOT to swallow unrelated exceptions elsewhere.
 */
function checkAuthSecret(): SecretCheck {
  const s = process.env.AUTH_SECRET;
  if (typeof s !== "string" || s.length === 0) return { ok: false, reason: "missing" };
  if (s.length < 32) return { ok: false, reason: "too_short" };
  if (/(CHANGE_ME|example\.com|replace-with)/i.test(s)) {
    return { ok: false, reason: "placeholder" };
  }
  return { ok: true, secret: s };
}

export function requireRolesFromRequest(
  request: { headers: { get(name: string): string | null } },
  allowed: readonly Role[],
): GuardResult {
  // Auth-secret check FIRST. If misconfigured, surface 503 before
  // attempting to read cookies (clean, deterministic).
  const sec = checkAuthSecret();
  if (!sec.ok) {
    return { ok: false, status: 503, error: "auth_secret_not_configured" };
  }
  const cookieHeader = request.headers.get("cookie");
  const token = readSessionCookie(cookieHeader);
  if (!token) return { ok: false, status: 401, error: "unauthenticated" };
  const v = verifySessionToken(token, sec.secret);
  if (!v.ok) return { ok: false, status: 401, error: "invalid_session" };
  if (!allowed.includes(v.session.role)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, session: v.session };
}

export const requireAdmin = (
  request: { headers: { get(name: string): string | null } },
): GuardResult => requireRolesFromRequest(request, ["admin"]);

export const requireAdminOrEditor = (
  request: { headers: { get(name: string): string | null } },
): GuardResult => requireRolesFromRequest(request, ["admin", "editor"]);

export const requireAnySession = (
  request: { headers: { get(name: string): string | null } },
): GuardResult => requireRolesFromRequest(request, ALL_ROLES);

/**
 * Map a guard result to a NextResponse-compatible Response object.
 * Routes can simply `return guardResponse(result)` for non-OK cases.
 */
export function guardResponse(result: GuardResult): Response | null {
  if (result.ok) return null;
  return new Response(
    JSON.stringify({ ok: false, error: result.error }),
    { status: result.status, headers: { "content-type": "application/json" } },
  );
}
