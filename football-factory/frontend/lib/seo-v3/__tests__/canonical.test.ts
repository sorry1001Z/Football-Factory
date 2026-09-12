// Football Factory — SEO V3 canonical validator tests (Wave A).

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCanonical, tryCanonical } from "../canonical";

const ORIGIN = "https://Example.COM";

test("canonical relative", () => {
  const r = validateCanonical(ORIGIN, "/a");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/a");
});

test("canonical same-origin absolute", () => {
  const r = validateCanonical(ORIGIN, "https://example.com/a");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/a");
});

test("canonical rejects cross-origin", () => {
  const r = validateCanonical(ORIGIN, "https://evil.test/a");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "CROSS_ORIGIN");
});

test("canonical allows explicit external host", () => {
  const r = validateCanonical(ORIGIN, "https://cdn.test/a", {
    allowedHosts: ["cdn.test"],
    allowExternal: true,
  });
  assert.equal(r.ok, true);
});

test("canonical rejects javascript:", () => {
  const r = validateCanonical(ORIGIN, "javascript:alert(1)");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "DISALLOWED_PROTOCOL");
});

test("canonical rejects data:", () => {
  const r = validateCanonical(ORIGIN, "data:text/plain,x");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "DISALLOWED_PROTOCOL");
});

test("canonical rejects file:", () => {
  const r = validateCanonical(ORIGIN, "file:///etc/passwd");
  assert.equal(r.ok, false);
});

test("canonical strips query", () => {
  const r = validateCanonical(ORIGIN, "/a?x=1");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/a");
});

test("canonical strips hash", () => {
  const r = validateCanonical(ORIGIN, "/a#x");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/a");
});

test("canonical duplicate slashes collapse", () => {
  const r = validateCanonical(ORIGIN, "/a//b///");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/a/b");
});

test("canonical root path", () => {
  const r = validateCanonical(ORIGIN, "/");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/");
});

test("canonical empty input is rejected", () => {
  const r = validateCanonical(ORIGIN, "");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "EMPTY_INPUT");
});

test("canonical null input is rejected", () => {
  const r = validateCanonical(ORIGIN, null);
  assert.equal(r.ok, false);
});

test("allowExternal without explicit host is same-origin only", () => {
  const r = validateCanonical(ORIGIN, "https://evil.test/a", {
    allowExternal: true,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "CROSS_ORIGIN");
});

test("tryCanonical returns null on failure", () => {
  assert.equal(tryCanonical(ORIGIN, "https://evil.test/x"), null);
});
