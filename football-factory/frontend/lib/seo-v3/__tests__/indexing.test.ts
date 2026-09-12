// Football Factory — SEO V3 indexing policy tests (Wave A).

import { test } from "node:test";
import assert from "node:assert/strict";
import { indexingPolicy } from "../indexing";

test("indexing: ok when contentUnits >= minContentUnits", () => {
  const r = indexingPolicy({ contentUnits: 3, minContentUnits: 3 });
  assert.equal(r.index, true);
  assert.equal(r.robots, "index,follow");
  assert.equal(r.reason, "OK");
});

test("indexing: THIN when contentUnits < minContentUnits", () => {
  const r = indexingPolicy({ contentUnits: 2, minContentUnits: 3 });
  assert.equal(r.index, false);
  assert.equal(r.robots, "noindex,follow");
  assert.equal(r.reason, "THIN");
});

test("indexing: BLOCKED → noindex,nofollow", () => {
  const r = indexingPolicy({ blocked: true });
  assert.equal(r.index, false);
  assert.equal(r.follow, false);
  assert.equal(r.robots, "noindex,nofollow");
  assert.equal(r.reason, "BLOCKED");
});

test("indexing: invalid canonical → noindex,follow", () => {
  const r = indexingPolicy({ canonicalValid: false });
  assert.equal(r.index, false);
  assert.equal(r.follow, true);
  assert.equal(r.reason, "INVALID_CANONICAL");
});

test("indexing: policy noindex → noindex,follow", () => {
  const r = indexingPolicy({ indexable: false });
  assert.equal(r.index, false);
  assert.equal(r.follow, true);
  assert.equal(r.reason, "POLICY_NOINDEX");
});

test("indexing: defaults safe", () => {
  const r = indexingPolicy();
  assert.equal(r.reason, "OK");
  assert.equal(r.index, true);
});
