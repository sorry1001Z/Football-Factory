// Tests for redact-secrets helper (FIRST SLICE / 003).
//
// The redaction function is recursive. It must:
//   - Replace forbidden keys at any depth with "[REDACTED]".
//   - Leave non-forbidden keys unchanged.
//   - Match patterns: secret|password|token|authorization|cookie|x-*-secret.
//   - Not mutate the input.

import test from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "@/lib/auth/redact-secrets";

test("redact: removes top-level forbidden keys", () => {
  const r = redactSecrets({
    password: "p1",
    secret: "s1",
    token: "t1",
    authorization: "a1",
    cookie: "c1",
    safe: "ok",
  }) as Record<string, unknown>;
  assert.equal(r.password, "[REDACTED]");
  assert.equal(r.secret, "[REDACTED]");
  assert.equal(r.token, "[REDACTED]");
  assert.equal(r.authorization, "[REDACTED]");
  assert.equal(r.cookie, "[REDACTED]");
  assert.equal(r.safe, "ok");
});

test("redact: removes x-*-secret headers (e.g. x-automation-secret, x-ff-revalidate-secret)", () => {
  const r = redactSecrets({
    "x-automation-secret": "shh",
    "x-ff-revalidate-secret": "shh2",
    "x-other": "keep",
  }) as Record<string, unknown>;
  assert.equal(r["x-automation-secret"], "[REDACTED]");
  assert.equal(r["x-ff-revalidate-secret"], "[REDACTED]");
  assert.equal(r["x-other"], "keep");
});

test("redact: recurses into nested objects", () => {
  const r = redactSecrets({
    metadata: {
      nested: { token: "nested-secret", keep: "fine" },
      list: [{ password: "in-list" }],
    },
  }) as { metadata: { nested: Record<string, unknown>; list: Array<Record<string, unknown>> } };
  assert.equal(r.metadata.nested.token, "[REDACTED]");
  assert.equal(r.metadata.nested.keep, "fine");
  assert.equal(r.metadata.list[0].password, "[REDACTED]");
});

test("redact: recurses into arrays", () => {
  const r = redactSecrets([
    { password: "a" },
    { token: "b" },
    { keep: "ok" },
  ]) as Array<Record<string, unknown>>;
  assert.equal(r[0].password, "[REDACTED]");
  assert.equal(r[1].token, "[REDACTED]");
  assert.equal(r[2].keep, "ok");
});

test("redact: does not mutate input", () => {
  const input = { password: "secret", nested: { token: "t" } };
  const snapshot = JSON.stringify(input);
  redactSecrets(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test("redact: handles null/undefined safely", () => {
  assert.equal(redactSecrets(null as never), null);
  assert.equal(redactSecrets(undefined as never), undefined);
});

test("redact: matches underscore- and dash-separated variants (api_secret, api-secret, api.token)", () => {
  const r = redactSecrets({
    api_secret: "1",
    "api-secret": "2",
    "api.token": "3",
    "auth_token": "4",
    "user-password": "5",
    bearer: "keep",
  }) as Record<string, unknown>;
  assert.equal(r.api_secret, "[REDACTED]");
  assert.equal(r["api-secret"], "[REDACTED]");
  assert.equal(r["api.token"], "[REDACTED]");
  assert.equal(r["auth_token"], "[REDACTED]");
  assert.equal(r["user-password"], "[REDACTED]");
  assert.equal(r.bearer, "keep");
});
