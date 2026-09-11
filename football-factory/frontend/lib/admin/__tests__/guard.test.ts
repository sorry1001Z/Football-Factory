// Tests for the admin guard (FIRST SLICE).
//
// Covers:
//   - anonymous (no cookie) → 401 unauthenticated
//   - invalid/expired/tampered session → 401 invalid_session
//   - member trying admin mutation → 403 forbidden
//   - editor → allowed for admin-or-editor routes
//   - admin → allowed for admin-only routes
//   - alg:none in token → 401 invalid_session

import test from "node:test";
import assert from "node:assert/strict";
import {
  requireAdmin,
  requireAdminOrEditor,
  requireRolesFromRequest,
  guardResponse,
} from "@/lib/admin/guard";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { b64url } from "@/lib/auth/__tests__/_b64url";

// Set AUTH_SECRET before importing the guard module-level call.
process.env.AUTH_SECRET = "a".repeat(32);
process.env.SESSION_COOKIE_NAME = "ff_session";

function requestWithCookie(cookie: string | null): { headers: { get(name: string): string | null } } {
  return {
    headers: {
      get(name: string): string | null {
        if (name === "cookie") return cookie;
        return null;
      },
    },
  };
}

function requestWithCookieAnd(cookie: string | null, extra: Record<string, string>): { headers: { get(name: string): string | null } } {
  return {
    headers: {
      get(name: string): string | null {
        if (name === "cookie") return cookie;
        if (extra[name] !== undefined) return extra[name];
        return null;
      },
    },
  };
}

test("guard: anonymous → 401 unauthenticated", () => {
  const r = requireAdmin(requestWithCookie(null));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 401);
    assert.equal(r.error, "unauthenticated");
  }
});

test("guard: tampered session → 401 invalid_session", () => {
  const tok = createSessionToken(
    { userId: "u1", role: "admin", email: "x@y.z" },
    process.env.AUTH_SECRET!,
    60,
  );
  const tampered = tok + "x";
  const r = requireAdmin(requestWithCookie(`ff_session=${tampered}`));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 401);
    assert.equal(r.error, "invalid_session");
  }
});

test("guard: expired session → 401 invalid_session", () => {
  const tok = createSessionToken(
    { userId: "u1", role: "admin", email: "x@y.z" },
    process.env.AUTH_SECRET!,
    -10,
  );
  const r = requireAdmin(requestWithCookie(`ff_session=${tok}`));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "invalid_session");
});

test("guard: member trying admin-only mutation → 403 forbidden", () => {
  const tok = createSessionToken(
    { userId: "u1", role: "member", email: "x@y.z" },
    process.env.AUTH_SECRET!,
    60,
  );
  const r = requireAdmin(requestWithCookie(`ff_session=${tok}`));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 403);
    assert.equal(r.error, "forbidden");
  }
});

test("guard: editor → allowed for requireAdminOrEditor", () => {
  const tok = createSessionToken(
    { userId: "u1", role: "editor", email: "x@y.z" },
    process.env.AUTH_SECRET!,
    60,
  );
  const r = requireAdminOrEditor(requestWithCookie(`ff_session=${tok}`));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.session.role, "editor");
});

test("guard: admin → allowed for requireAdmin", () => {
  const tok = createSessionToken(
    { userId: "u1", role: "admin", email: "x@y.z" },
    process.env.AUTH_SECRET!,
    60,
  );
  const r = requireAdmin(requestWithCookie(`ff_session=${tok}`));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.session.role, "admin");
});

test("guard: editor rejected by requireAdmin (only)", () => {
  const tok = createSessionToken(
    { userId: "u1", role: "editor", email: "x@y.z" },
    process.env.AUTH_SECRET!,
    60,
  );
  const r = requireAdmin(requestWithCookie(`ff_session=${tok}`));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 403);
    assert.equal(r.error, "forbidden");
  }
});

test("guard: alg:none session → 401 invalid_session", () => {
  // Build an alg:none token manually.
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      userId: "u1",
      role: "admin",
      email: "x@y.z",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  );
  const tok = `${header}.${payload}.`;
  const r = requireAdmin(requestWithCookie(`ff_session=${tok}`));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 401);
    assert.equal(r.error, "invalid_session");
  }
});

test("guard: guardResponse returns Response for non-OK, null for OK", () => {
  const bad = guardResponse({ ok: false, status: 401, error: "unauthenticated" });
  assert.ok(bad instanceof Response);
  assert.equal((bad as Response).status, 401);
  const ok = guardResponse({ ok: true, session: { userId: "u", role: "admin", email: "x", iat: 0, exp: 0 } });
  assert.equal(ok, null);
});

// =============================================================
// Regression tests for the AUTH_SECRET misconfiguration path
// (FIRST SLICE fix: guard returns 503 instead of throwing 500).
// These tests temporarily clear AUTH_SECRET and verify every
// protected-path entry returns 503 auth_secret_not_configured
// instead of an unhandled exception.
// =============================================================

function withClearedAuthSecret<T>(fn: () => T): T {
  const prev = process.env.AUTH_SECRET;
  delete process.env.AUTH_SECRET;
  try {
    return fn();
  } finally {
    if (typeof prev === "string") process.env.AUTH_SECRET = prev;
    else delete process.env.AUTH_SECRET;
  }
}

test("guard: missing AUTH_SECRET + no cookie → 503 (NOT 500)", () => {
  const r = withClearedAuthSecret(() =>
    requireAdmin(requestWithCookie(null)),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 503);
    assert.equal(r.error, "auth_secret_not_configured");
  }
});

test("guard: missing AUTH_SECRET + malformed cookie → 503 (NOT 500)", () => {
  const r = withClearedAuthSecret(() =>
    requireAdmin(requestWithCookie("ff_session=not.a.real.jwt")),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 503);
    assert.equal(r.error, "auth_secret_not_configured");
  }
});

test("guard: missing AUTH_SECRET + tampered cookie → 503 (NOT 500)", () => {
  const r = withClearedAuthSecret(() =>
    requireAdmin(
      requestWithCookie(
        "ff_session=YWJjZGVmZ2hpamtsbW5vcA.invalid.signatureXYZ",
      ),
    ),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 503);
    assert.equal(r.error, "auth_secret_not_configured");
  }
});

test("guard: missing AUTH_SECRET + alg:none cookie → 503 (NOT 500)", () => {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      userId: "u1",
      role: "admin",
      email: "x@y.z",
      iat: 1,
      exp: 9999999999,
    }),
  );
  const tok = `${header}.${payload}.`;
  const r = withClearedAuthSecret(() =>
    requireAdmin(requestWithCookie(`ff_session=${tok}`)),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 503);
    assert.equal(r.error, "auth_secret_not_configured");
  }
});

test("guard: missing AUTH_SECRET + valid-looking cookie → 503 (NOT 500)", () => {
  // Even if a valid cookie is present, misconfigured AUTH_SECRET
  // must produce a clean 503, not an unhandled exception.
  const secretBackup = process.env.AUTH_SECRET;
  const tok = createSessionToken(
    { userId: "u1", role: "admin", email: "x@y.z" },
    "a".repeat(32),
    60,
  );
  delete process.env.AUTH_SECRET;
  try {
    const r = requireAdmin(requestWithCookie(`ff_session=${tok}`));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 503);
      assert.equal(r.error, "auth_secret_not_configured");
    }
  } finally {
    if (typeof secretBackup === "string") process.env.AUTH_SECRET = secretBackup;
    else delete process.env.AUTH_SECRET;
  }
});

test("guard: placeholder AUTH_SECRET → 503 (NOT 500)", () => {
  const prev = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "CHANGE_ME_min_32_chars_xxxxxxxxxxxxxx";
  try {
    const r = requireAdmin(requestWithCookie(null));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 503);
      assert.equal(r.error, "auth_secret_not_configured");
    }
  } finally {
    if (typeof prev === "string") process.env.AUTH_SECRET = prev;
    else delete process.env.AUTH_SECRET;
  }
});

test("guard: too-short AUTH_SECRET → 503 (NOT 500)", () => {
  const prev = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "short";
  try {
    const r = requireAdmin(requestWithCookie(null));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 503);
      assert.equal(r.error, "auth_secret_not_configured");
    }
  } finally {
    if (typeof prev === "string") process.env.AUTH_SECRET = prev;
    else delete process.env.AUTH_SECRET;
  }
});

test("guard: guardResponse maps the new 503 variant correctly", () => {
  const res = guardResponse({
    ok: false,
    status: 503,
    error: "auth_secret_not_configured",
  });
  assert.ok(res instanceof Response);
  if (res instanceof Response) {
    assert.equal(res.status, 503);
  }
});
