// Football Factory — auth route helper (FIRST SLICE).
//
// Builds an AuthService instance if DATABASE_URL and AUTH_SECRET are
// configured. Routes call this and surface 503 with a clear error if
// not yet provisioned. NEVER logs the secret.

import "server-only";
import { getDb } from "@/lib/db/postgres";
import { AuthService, AuthError } from "@/lib/auth/auth-service";

export type AuthServiceResult =
  | { ok: true; service: AuthService }
  | { ok: false; status: 503; error: string };

export function getAuthService(): AuthServiceResult {
  if (!process.env.DATABASE_URL) {
    return { ok: false, status: 503, error: "auth_db_not_configured" };
  }
  if (
    !process.env.AUTH_SECRET ||
    process.env.AUTH_SECRET.length < 32 ||
    /(CHANGE_ME|example\.com|replace-with)/i.test(process.env.AUTH_SECRET)
  ) {
    return { ok: false, status: 503, error: "auth_secret_not_configured" };
  }
  try {
    return {
      ok: true,
      service: new AuthService(
        getDb(),
        process.env.AUTH_SECRET,
        process.env.SESSION_TTL_SECONDS
          ? Number(process.env.SESSION_TTL_SECONDS)
          : undefined,
      ),
    };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, status: 503, error: e.code };
    }
    return { ok: false, status: 503, error: "auth_init_failed" };
  }
}

export function authUnavailableResponse(r: Extract<AuthServiceResult, { ok: false }>): Response {
  return new Response(
    JSON.stringify({ ok: false, error: r.error }),
    { status: r.status, headers: { "content-type": "application/json" } },
  );
}
