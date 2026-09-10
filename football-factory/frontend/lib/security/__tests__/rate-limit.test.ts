// Tests for the rate limiter (FIRST SLICE).
//
// Covers:
//   - first call inside window → ok
//   - subsequent calls up to limit → ok
//   - call beyond limit → not ok with reset_ms
//   - different keys → isolated

import test from "node:test";
import assert from "node:assert/strict";
import { consume } from "@/lib/security/rate-limit";

test("rate-limit: first call inside window → ok", () => {
  const r = consume("k1", 5, 60_000);
  assert.equal(r.ok, true);
  assert.equal(r.remaining, 4);
});

test("rate-limit: 5 calls in window → all ok, 6th not ok", () => {
  for (let i = 0; i < 5; i++) {
    const r = consume("k2", 5, 60_000);
    assert.equal(r.ok, true, `call ${i} should be ok`);
  }
  const r6 = consume("k2", 5, 60_000);
  assert.equal(r6.ok, false);
  assert.ok(r6.reset_ms > 0);
});

test("rate-limit: different keys isolated", () => {
  for (let i = 0; i < 5; i++) consume("k3", 5, 60_000);
  // k3 is now exhausted
  assert.equal(consume("k3", 5, 60_000).ok, false);
  // but k4 is fresh
  assert.equal(consume("k4", 5, 60_000).ok, true);
});

test("rate-limit: window expiry releases the slot", async () => {
  const r = consume("k5", 2, 30);
  assert.equal(r.ok, true);
  consume("k5", 2, 30);
  assert.equal(consume("k5", 2, 30).ok, false);
  // wait > window
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(consume("k5", 2, 30).ok, true);
});
