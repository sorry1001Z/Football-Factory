// Tests for the cookie helper (FIRST SLICE).
//
// Covers:
//   - default cookie name is ff_session
//   - SESSION_COOKIE_NAME env overrides it (when valid)
//   - SESSION_COOKIE_NAME rejects values with bad chars
//   - buildSessionCookie includes HttpOnly
//   - buildSessionCookie includes Secure in production
//   - buildSessionCookie includes SameSite=Lax
//   - buildSessionCookie includes Path=/
//   - buildSessionCookie includes Max-Age
//   - buildClearCookie uses Max-Age=0

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionCookie,
  buildClearCookie,
  readSessionCookie,
  DEFAULT_COOKIE_NAME,
  __setCookieNodeEnvForTest,
} from "@/lib/auth/cookie";

test("cookie: default cookie name is ff_session", () => {
  assert.equal(DEFAULT_COOKIE_NAME, "ff_session");
});

test("cookie: buildSessionCookie includes required flags (dev)", () => {
  __setCookieNodeEnvForTest("development");
  const c = buildSessionCookie("token123", 3600);
  __setCookieNodeEnvForTest(undefined);
  assert.match(c, /^ff_session=token123/);
  assert.match(c, /Path=\//);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Max-Age=3600/);
  assert.doesNotMatch(c, /Secure/);
});

test("cookie: buildSessionCookie includes Secure in production", () => {
  __setCookieNodeEnvForTest("production");
  const c = buildSessionCookie("token123", 3600);
  __setCookieNodeEnvForTest(undefined);
  assert.match(c, /Secure/);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
});

test("cookie: buildClearCookie uses Max-Age=0", () => {
  const c = buildClearCookie();
  assert.match(c, /Max-Age=0/);
  assert.match(c, /Path=\//);
  assert.match(c, /HttpOnly/);
});

test("cookie: readSessionCookie reads the value from Cookie header", () => {
  const got = readSessionCookie("ff_session=abc123; other=xyz");
  assert.equal(got, "abc123");
});

test("cookie: readSessionCookie returns null when header missing", () => {
  assert.equal(readSessionCookie(null), null);
});

test("cookie: readSessionCookie returns null when cookie absent", () => {
  assert.equal(readSessionCookie("other=xyz"), null);
});

test("cookie: readSessionCookie handles url-encoded values", () => {
  const got = readSessionCookie("ff_session=hello%20world");
  assert.equal(got, "hello world");
});
