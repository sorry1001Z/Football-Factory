// Football Factory — stats.test.mjs (R2 Wave 1).
//
// Ported from external Performance / Observability R2 pack
// (tests/stats.test.mjs). Tests scripts/_stats.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { summarize, percentile } from "../_stats.mjs";

test("summarize: p50 and p95 on a 10-element sorted array", () => {
  const s = summarize([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.equal(s.count, 10);
  assert.equal(s.p50, 50);
  assert.equal(s.p95, 100);
  assert.equal(s.min, 10);
  assert.equal(s.max, 100);
});

test("summarize: empty array returns 0 p50/p95", () => {
  const s = summarize([]);
  assert.equal(s.count, 0);
  assert.equal(s.p50, 0);
  assert.equal(s.p95, 0);
  assert.equal(s.min, Number.POSITIVE_INFINITY);
  assert.equal(s.max, Number.NEGATIVE_INFINITY);
});

test("summarize: single element", () => {
  const s = summarize([42]);
  assert.equal(s.count, 1);
  assert.equal(s.p50, 42);
  assert.equal(s.p95, 42);
  assert.equal(s.min, 42);
  assert.equal(s.max, 42);
});

test("summarize: unsorted input is sorted internally", () => {
  const s = summarize([100, 10, 50, 30, 80]);
  assert.equal(s.p50, 50);
  assert.equal(s.min, 10);
  assert.equal(s.max, 100);
});

test("percentile: clamps to last index when p*len overshoots", () => {
  const xs = [1, 2, 3, 4, 5];
  assert.equal(percentile(xs, 1.0), 5);
  assert.equal(percentile(xs, 0.999), 5);
});

test("percentile: empty array returns 0", () => {
  assert.equal(percentile([], 0.5), 0);
});
