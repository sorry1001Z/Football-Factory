// Football Factory — admin guard (FIRST SLICE).
//
// Reads the session cookie, verifies the HS256 JWT-like token, and
// enforces the allowed-role list. The result type is discriminated so
// callers can map directly to HTTP responses.
//
// Behavior:
//   - no cookie             → 401 unauthenticated
//   - bad/expired/tampered  → 401 invalid_session
//   - role not in allowlist → 403 forbidden
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
  | { ok: false; status: 403; error: "forbidden" };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (
    typeof s !== "string" ||
    s.length < 32 ||
    /(CHANGE_ME|example\.com|replace-with)/i.test(s)
  ) {
    throw new Error(
      "AUTH_SECRET must be >= 32 chars and not a placeholder",
    );
  }
  return s;
}

export function requireRolesFromRequest(
  request: { headers: { get(name: string): string | null } },
  allowed: readonly Role[],
): GuardResult {
  const cookieHeader = request.headers.get("cookie");
  const token = readSessionCookie(cookieHeader);
  if (!token) return { ok: false, status: 401, error: "unauthenticated" };
  const v = verifySessionToken(token, secret());
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
