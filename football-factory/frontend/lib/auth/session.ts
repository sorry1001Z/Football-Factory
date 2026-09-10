// Football Factory — session token (FIRST SLICE).
//
// HS256 JWT-like token. Built on Node built-in crypto (no external
// jsonwebtoken dependency). Format:
//
//   <header-b64url>.<payload-b64url>.<signature-b64url>
//
// Hardening beyond the external package:
//   - explicit alg === "HS256" check (H1 finding closed).
//   - explicit reject of alg === "none" or any non-HS256.
//   - iat claim required and recorded (for token-age auditing).
//   - timing-safe signature compare with length check.
//   - role allowlist verification in addition to exp check.
//   - AUTH_SECRET length validation in createSessionToken.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isRole, type JwtHeader, type Role, type Session } from "./contracts";

const MIN_SECRET_LEN = 32;
const PLACEHOLDER_RE = /(CHANGE_ME|example\.com|replace-with)/i;

function b64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function unb64url(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(s, "base64").toString("utf8");
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(body)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function assertSecret(secret: string): void {
  if (
    typeof secret !== "string" ||
    secret.length < MIN_SECRET_LEN ||
    PLACEHOLDER_RE.test(secret)
  ) {
    throw new Error(
      `AUTH_SECRET must be >= ${MIN_SECRET_LEN} chars and not a placeholder`,
    );
  }
}

export function createSessionToken(
  data: { userId: string; role: Role; email: string },
  secret: string,
  ttlSeconds: number = 60 * 60 * 24 * 7, // 7 days
): string {
  assertSecret(secret);
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  // Allow negative ttl (used in tests to forge an expired token); do
  // NOT clamp up to 1 because that would silently change the meaning.
  const exp = now + Math.floor(ttlSeconds);
  const payload: Omit<Session, "userId" | "role" | "email"> & {
    userId: string;
    role: Role;
    email: string;
  } = {
    userId: data.userId,
    role: data.role,
    email: data.email,
    iat: now,
    exp,
  };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const body = `${h}.${p}`;
  return `${body}.${sign(body, secret)}`;
}

export type SessionVerifyResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "bad_role" };

export function verifySessionToken(
  token: string,
  secret: string,
): SessionVerifyResult {
  if (typeof token !== "string" || !token) {
    return { ok: false, reason: "malformed" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [h, p, s] = parts;
  if (!h || !p || !s) return { ok: false, reason: "malformed" };

  // 1. Verify signature FIRST (constant-time, length-checked).
  let expected: string;
  try {
    expected = sign(`${h}.${p}`, secret);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  // 2. Parse header and reject non-HS256 / none (H1 finding closed).
  let header: JwtHeader;
  try {
    header = JSON.parse(unb64url(h)) as JwtHeader;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    return { ok: false, reason: "malformed" };
  }

  // 3. Parse payload and verify claims.
  let payload: unknown;
  try {
    payload = JSON.parse(unb64url(p));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Session).userId !== "string" ||
    typeof (payload as Session).email !== "string" ||
    typeof (payload as Session).exp !== "number" ||
    typeof (payload as Session).iat !== "number" ||
    !isRole((payload as Session).role)
  ) {
    return { ok: false, reason: "bad_role" };
  }
  if ((payload as Session).exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, session: payload as Session };
}
