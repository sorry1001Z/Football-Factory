// Football Factory — cookie helpers (FIRST SLICE).
//
// Build and clear the session cookie with secure-by-default flags.
// All cookies produced here have:
//   - HttpOnly
//   - Secure in production
//   - SameSite=Lax (default)
//   - Path=/
//   - explicit Max-Age or expires=0 for logout
//
// The cookie NAME comes from env SESSION_COOKIE_NAME (default: ff_session)
// so a future migration to a different name can be done without code
// changes.

import "server-only";

export const DEFAULT_COOKIE_NAME = "ff_session";

declare global {
  // eslint-disable-next-line no-var
  var __FF_COOKIE_NODE_ENV_OVERRIDE__: "production" | "development" | undefined;
}

export function getCookieName(): string {
  const raw = process.env.SESSION_COOKIE_NAME;
  if (typeof raw === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw)) {
    return raw;
  }
  return DEFAULT_COOKIE_NAME;
}

export type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "Lax" | "Strict" | "None";
  path: "/";
  maxAge?: number;
};

function effectiveNodeEnv(): string {
  return globalThis.__FF_COOKIE_NODE_ENV_OVERRIDE__ ?? process.env.NODE_ENV ?? "";
}

export function defaultCookieOptions(): CookieOptions {
  const isProd = effectiveNodeEnv() === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    path: "/",
  };
}

/** Test seam: set NODE_ENV override used by defaultCookieOptions. */
export function __setCookieNodeEnvForTest(
  v: "production" | "development" | undefined,
): void {
  globalThis.__FF_COOKIE_NODE_ENV_OVERRIDE__ = v;
}

export function buildSessionCookie(
  token: string,
  maxAgeSeconds: number,
): string {
  const opts = defaultCookieOptions();
  const parts = [
    `${getCookieName()}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    `Max-Age=${Math.max(1, Math.floor(maxAgeSeconds))}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookie(): string {
  const opts = defaultCookieOptions();
  const parts = [
    `${getCookieName()}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    "Max-Age=0",
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Parse a Cookie header and return the value for the session cookie.
 * Returns null if the header is missing or the cookie is absent.
 */
export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const name = getCookieName();
  for (const part of cookieHeader.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
