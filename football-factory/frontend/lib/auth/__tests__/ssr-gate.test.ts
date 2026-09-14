// Tests for the (admin) route-group SSR auth gate.
//
// The actual layout.tsx calls `cookies()` from next/headers and
// `redirect()` from next/navigation. Those are Next.js runtime APIs
// that only work inside the Next.js request handler. We don't have
// a Next runtime in unit tests, so we test the GATE PATTERN directly:
//   - given an empty cookie jar, the gate rejects and returns a
//     redirect signal
//   - given a valid admin session cookie, the gate accepts
//   - given a valid editor session cookie, the gate accepts
//   - given an author/member session cookie, the gate rejects
//   - given an expired session cookie, the gate rejects
//   - given a tampered session cookie, the gate rejects
//
// These tests guard against regression on the auth authority used by
// every admin SSR page. The layout calls into the SAME requireAdminOrEditor
// helper that is exercised here, so a green test means the production
// gate behaves the same way.

import test from "node:test";
import assert from "node:assert/strict";
import { createSessionToken } from "@/lib/auth/session";
import { requireAdminOrEditor } from "@/lib/admin/guard";

const SECRET = "test-secret-test-secret-test-secret-test-secret-32";

// Ensure AUTH_SECRET is configured for every test in this file.
// The guard checks AUTH_SECRET first; without it, every result is 503.
process.env.AUTH_SECRET = SECRET;

function buildHeaders(cookieValue: string | null): Headers {
  const h = new Headers();
  if (cookieValue) h.set("cookie", `ff_session=${encodeURIComponent(cookieValue)}`);
  return h;
}

function gate(headers: Headers) {
  // Mirror the (admin)/layout.tsx auth gate pattern.
  return requireAdminOrEditor({ headers: { get: (n) => headers.get(n) } });
}

test("ssr-gate: missing cookie → unauthenticated (401)", () => {
  const r = gate(buildHeaders(null));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "unauthenticated");
});

test("ssr-gate: admin session → accepted", () => {
  const tok = createSessionToken(
    { userId: "u1", role: "admin", email: "a@example.com" },
    SECRET,
    3600,
  );
  const r = gate(buildHeaders(tok));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.session.role, "admin");
    assert.equal(r.session.userId, "u1");
  }
});

test("ssr-gate: editor session → accepted", () => {
  const tok = createSessionToken(
    { userId: "u2", role: "editor", email: "e@example.com" },
    SECRET,
    3600,
  );
  const r = gate(buildHeaders(tok));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.session.role, "editor");
});

test("ssr-gate: author session → forbidden (403)", () => {
  const tok = createSessionToken(
    { userId: "u3", role: "author", email: "au@example.com" },
    SECRET,
    3600,
  );
  const r = gate(buildHeaders(tok));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "forbidden");
});

test("ssr-gate: member session → forbidden (403)", () => {
  const tok = createSessionToken(
    { userId: "u4", role: "member", email: "m@example.com" },
    SECRET,
    3600,
  );
  const r = gate(buildHeaders(tok));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "forbidden");
});

test("ssr-gate: expired session → invalid_session (401)", () => {
  const tok = createSessionToken(
    { userId: "u5", role: "admin", email: "x@example.com" },
    SECRET,
    -10, // already expired
  );
  const r = gate(buildHeaders(tok));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "invalid_session");
});

test("ssr-gate: tampered signature → invalid_session (401)", () => {
  const tok = createSessionToken(
    { userId: "u6", role: "admin", email: "y@example.com" },
    SECRET,
    3600,
  );
  // Flip a byte in the signature segment
  const parts = tok.split(".");
  parts[2] = "A".repeat(parts[2].length);
  const r = gate(buildHeaders(parts.join(".")));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "invalid_session");
});

test("ssr-gate: malformed token → invalid_session (401)", () => {
  const r = gate(buildHeaders("not.a.real.jwt"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "invalid_session");
});

test("ssr-gate: SESSION_COOKIE_NAME env override is honored", () => {
  const prev = process.env.SESSION_COOKIE_NAME;
  process.env.SESSION_COOKIE_NAME = "alt_session";
  try {
    const tok = createSessionToken(
      { userId: "u7", role: "editor", email: "z@example.com" },
      SECRET,
      3600,
    );
    // Sent under the override name, not ff_session
    const h = new Headers();
    h.set("cookie", `alt_session=${encodeURIComponent(tok)}`);
    const r = requireAdminOrEditor({ headers: { get: (n) => h.get(n) } });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.session.role, "editor");
  } finally {
    if (prev === undefined) delete process.env.SESSION_COOKIE_NAME;
    else process.env.SESSION_COOKIE_NAME = prev;
  }
});

test("ssr-gate: AUTH_SECRET not configured → 503 (auth_secret_not_configured)", () => {
  // requireAdminOrEditor's auth-secret check runs BEFORE cookie reading.
  // We can't easily un-configure AUTH_SECRET in process.env because
  // the guard reads it at call time; verify by setting it short.
  const prev = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "short";
  try {
    const r = gate(buildHeaders(null));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "auth_secret_not_configured");
  } finally {
    if (prev === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prev;
  }
});
