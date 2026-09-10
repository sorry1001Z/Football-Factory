// Tests for the automation auth helper (FIRST SLICE).
//
// Covers:
//   - missing env → 401 automation_secret_not_configured
//   - placeholder env → 401 automation_secret_not_configured
//   - missing header → 401 automation_secret_invalid
//   - wrong secret → 401 automation_secret_invalid
//   - correct secret → ok

import test from "node:test";
import assert from "node:assert/strict";
import { verifyAutomationSecret, AUTOMATION_SECRET_HEADER } from "@/lib/automation/auth";

function makeRequest(headers: Record<string, string>): { headers: { get(name: string): string | null } } {
  return {
    headers: {
      get(name: string): string | null {
        if (name === AUTOMATION_SECRET_HEADER) return headers[name] ?? null;
        return null;
      },
    },
  };
}

test("automation-auth: missing env → 401 not_configured", () => {
  const prev = process.env.AUTOMATION_SECRET;
  delete process.env.AUTOMATION_SECRET;
  const r = verifyAutomationSecret(makeRequest({ [AUTOMATION_SECRET_HEADER]: "anything" }));
  process.env.AUTOMATION_SECRET = prev;
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 401);
    assert.equal(r.error, "automation_secret_not_configured");
  }
});

test("automation-auth: placeholder env → 401 not_configured", () => {
  const prev = process.env.AUTOMATION_SECRET;
  process.env.AUTOMATION_SECRET = "CHANGE_ME_min_16_chars_xxxxx";
  const r = verifyAutomationSecret(makeRequest({ [AUTOMATION_SECRET_HEADER]: "anything" }));
  process.env.AUTOMATION_SECRET = prev;
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "automation_secret_not_configured");
});

test("automation-auth: missing header → 401 invalid", () => {
  process.env.AUTOMATION_SECRET = "a".repeat(20);
  const r = verifyAutomationSecret(makeRequest({}));
  delete process.env.AUTOMATION_SECRET;
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "automation_secret_invalid");
});

test("automation-auth: wrong secret → 401 invalid", () => {
  process.env.AUTOMATION_SECRET = "a".repeat(20);
  const r = verifyAutomationSecret(makeRequest({ [AUTOMATION_SECRET_HEADER]: "wrongvalue" }));
  delete process.env.AUTOMATION_SECRET;
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "automation_secret_invalid");
});

test("automation-auth: correct secret → ok", () => {
  const secret = "a".repeat(20);
  process.env.AUTOMATION_SECRET = secret;
  const r = verifyAutomationSecret(makeRequest({ [AUTOMATION_SECRET_HEADER]: secret }));
  delete process.env.AUTOMATION_SECRET;
  assert.equal(r.ok, true);
});
