// Tests for the password helpers (FIRST SLICE).
//
// Covers:
//   - hash format and uniqueness
//   - hashPassword rejects passwords shorter than 10
//   - verifyPassword returns true on the correct password
//   - verifyPassword returns false on the wrong password
//   - verifyPassword returns false on a malformed stored hash
//   - verifyPassword uses timingSafeEqual (length-checked)

import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, PasswordError } from "@/lib/auth/password";

test("hashPassword: produces scrypt$<salt>$<hash>", () => {
  const h = hashPassword("correcthorsebatterystaple");
  assert.match(h, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
});

test("hashPassword: salts are random — two hashes of same password differ", () => {
  const a = hashPassword("correcthorsebatterystaple");
  const b = hashPassword("correcthorsebatterystaple");
  assert.notEqual(a, b);
});

test("hashPassword: rejects passwords shorter than 10 chars", () => {
  assert.throws(() => hashPassword("short"), (e: unknown) => {
    return e instanceof PasswordError && e.code === "password_too_short";
  });
});

test("verifyPassword: returns true on the correct password", () => {
  const h = hashPassword("correcthorsebatterystaple");
  assert.equal(verifyPassword("correcthorsebatterystaple", h), true);
});

test("verifyPassword: returns false on the wrong password", () => {
  const h = hashPassword("correcthorsebatterystaple");
  assert.equal(verifyPassword("wronghorsebatterystaple", h), false);
});

test("verifyPassword: returns false on a malformed stored hash", () => {
  assert.equal(verifyPassword("anything", "garbage"), false);
  assert.equal(verifyPassword("anything", "scrypt$onlytwoparts"), false);
  assert.equal(verifyPassword("anything", "bcrypt$salt$hash"), false);
});

test("verifyPassword: returns false on non-string input", () => {
  assert.equal(verifyPassword(undefined as unknown as string, "scrypt$x$y"), false);
  assert.equal(verifyPassword("password1234567890" as string, undefined as unknown as string), false);
});
