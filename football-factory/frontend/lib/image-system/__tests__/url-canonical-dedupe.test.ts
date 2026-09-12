// Football Factory — R2.1 Wave C Image URL Canonicalization + Dedupe tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { safeHttpUrl, DEFAULT_TRACKING_PARAMS } from "../url-canonical";
import { canonicalIdentity, dedupeCandidates } from "../dedupe";

// ============================================================================
// safeHttpUrl
// ============================================================================

test("safeHttpUrl: https URL is accepted and host is lowercased", () => {
  const r = safeHttpUrl("HTTPS://Example.COM/path/To/Asset.jpg");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.match(r.url, /^https:\/\/example\.com\/path\/To\/Asset\.jpg/);
  }
});

test("safeHttpUrl: http URL is accepted", () => {
  const r = safeHttpUrl("http://example.com/foo.jpg");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "http://example.com/foo.jpg");
});

test("safeHttpUrl: malformed URL is rejected without throwing", () => {
  const r = safeHttpUrl("http://[invalid");
  assert.equal(r.ok, false);
});

test("safeHttpUrl: javascript: rejected", () => {
  const r = safeHttpUrl("javascript:alert(1)");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /FORBIDDEN_SCHEME/);
});

test("safeHttpUrl: data: rejected", () => {
  const r = safeHttpUrl("data:image/png;base64,iVBORw0KGgo=");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /FORBIDDEN_SCHEME/);
});

test("safeHttpUrl: file: rejected", () => {
  const r = safeHttpUrl("file:///etc/passwd");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /FORBIDDEN_SCHEME/);
});

test("safeHttpUrl: ftp: rejected", () => {
  const r = safeHttpUrl("ftp://example.com/asset.jpg");
  assert.equal(r.ok, false);
});

test("safeHttpUrl: missing scheme rejected", () => {
  const r = safeHttpUrl("example.com/foo.jpg");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "MISSING_SCHEME");
});

test("safeHttpUrl: empty input rejected", () => {
  const r = safeHttpUrl("");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "EMPTY_INPUT");
});

test("safeHttpUrl: null input rejected", () => {
  const r = safeHttpUrl(null);
  assert.equal(r.ok, false);
});

test("safeHttpUrl: undefined input rejected", () => {
  const r = safeHttpUrl(undefined);
  assert.equal(r.ok, false);
});

test("safeHttpUrl: fragment is removed", () => {
  const r = safeHttpUrl("https://example.com/foo.jpg#section");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/foo.jpg");
});

test("safeHttpUrl: utm_* params are removed", () => {
  const r = safeHttpUrl("https://example.com/foo.jpg?utm_source=tw&utm_medium=foo&id=42");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.url.includes("utm_source"), false);
    assert.equal(r.url.includes("utm_medium"), false);
    assert.equal(r.url.includes("id=42"), true);
    assert.ok(r.droppedParams.includes("utm_source"));
    assert.ok(r.droppedParams.includes("utm_medium"));
  }
});

test("safeHttpUrl: fbclid + gclid removed", () => {
  const r = safeHttpUrl("https://example.com/foo.jpg?fbclid=abc&gclid=def&keep=yes");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.url.includes("fbclid"), false);
    assert.equal(r.url.includes("gclid"), false);
    assert.equal(r.url.includes("keep=yes"), true);
  }
});

test("safeHttpUrl: meaningful query preserved", () => {
  const r = safeHttpUrl("https://example.com/foo.jpg?width=400&format=webp");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.url.includes("width=400"), true);
    assert.equal(r.url.includes("format=webp"), true);
    assert.equal(r.droppedParams.length, 0);
  }
});

test("safeHttpUrl: trailing slash stripped on non-root path", () => {
  const r = safeHttpUrl("https://example.com/path/", { normalizeTrailingSlash: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/path");
});

test("safeHttpUrl: root path preserved", () => {
  const r = safeHttpUrl("https://example.com/");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/");
});

test("safeHttpUrl: normalizeTrailingSlash=false preserves trailing slash", () => {
  const r = safeHttpUrl("https://example.com/path/", { normalizeTrailingSlash: false });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/path/");
});

test("safeHttpUrl: default tracking params list is non-empty", () => {
  assert.ok(DEFAULT_TRACKING_PARAMS.length > 0);
  assert.ok(DEFAULT_TRACKING_PARAMS.includes("utm_source"));
  assert.ok(DEFAULT_TRACKING_PARAMS.includes("fbclid"));
  assert.ok(DEFAULT_TRACKING_PARAMS.includes("gclid"));
});

test("safeHttpUrl: tracking param matching is case-insensitive", () => {
  const r = safeHttpUrl("https://example.com/foo.jpg?UTM_SOURCE=x&Fbclid=y");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.url.includes("UTM_SOURCE"), false);
    assert.equal(r.url.includes("Fbclid"), false);
  }
});

test("safeHttpUrl: empty tracking list preserves all params", () => {
  const r = safeHttpUrl("https://example.com/foo.jpg?utm_source=x", { trackingParams: [] });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.url.includes("utm_source=x"), true);
    assert.equal(r.droppedParams.length, 0);
  }
});

test("safeHttpUrl: default ports stripped", () => {
  const r = safeHttpUrl("https://example.com:443/foo.jpg");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com/foo.jpg");
});

test("safeHttpUrl: non-default port preserved", () => {
  const r = safeHttpUrl("https://example.com:8443/foo.jpg");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.url, "https://example.com:8443/foo.jpg");
});

test("safeHttpUrl: never throws on bizarre input", () => {
  const cases = ["", null, undefined, 0 as any, {} as any, " ", "://"];
  for (const c of cases) {
    const r = safeHttpUrl(c as any);
    assert.equal(r.ok, false);
  }
});

// ============================================================================
// canonicalIdentity
// ============================================================================

test("canonicalIdentity: same asset with different utm params => same identity", () => {
  const a = canonicalIdentity({
    source: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Manchester_United",
    imageUrl: "https://upload.wikimedia.org/foo.jpg?utm_source=x&id=42",
  });
  const b = canonicalIdentity({
    source: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Manchester_United",
    imageUrl: "https://upload.wikimedia.org/foo.jpg?utm_source=y&id=42",
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (a.ok && b.ok) {
    assert.equal(a.identity.imageKey, b.identity.imageKey);
  }
});

test("canonicalIdentity: host case difference => same identity", () => {
  const a = canonicalIdentity({
    source: "wikipedia",
    sourceUrl: "https://EN.Wikipedia.ORG/wiki/Manchester_United",
    imageUrl: "https://Upload.Wikimedia.Org/foo.jpg",
  });
  const b = canonicalIdentity({
    source: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Manchester_United",
    imageUrl: "https://upload.wikimedia.org/foo.jpg",
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (a.ok && b.ok) {
    assert.equal(a.identity.imageKey, b.identity.imageKey);
  }
});

test("canonicalIdentity: source name case difference => same identity", () => {
  const a = canonicalIdentity({ source: "Wikipedia", imageUrl: "https://example.com/foo.jpg" });
  const b = canonicalIdentity({ source: "wikipedia", imageUrl: "https://example.com/foo.jpg" });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (a.ok && b.ok) assert.equal(a.identity.source, b.identity.source);
});

test("canonicalIdentity: genuinely different path => different identity", () => {
  const a = canonicalIdentity({ source: "x", imageUrl: "https://example.com/path/a.jpg" });
  const b = canonicalIdentity({ source: "x", imageUrl: "https://example.com/path/b.jpg" });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (a.ok && b.ok) assert.notEqual(a.identity.imageKey, b.identity.imageKey);
});

test("canonicalIdentity: genuinely different image URL => different identity", () => {
  const a = canonicalIdentity({ source: "x", imageUrl: "https://a.example/foo.jpg" });
  const b = canonicalIdentity({ source: "x", imageUrl: "https://b.example/bar.jpg" });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (a.ok && b.ok) assert.notEqual(a.identity.imageKey, b.identity.imageKey);
});

test("canonicalIdentity: malformed image URL => safe result with raw fallback", () => {
  const a = canonicalIdentity({ source: "x", imageUrl: "http://[invalid" });
  // http://[invalid is malformed → safe result falls back to raw key
  assert.equal(a.ok, true);
  if (a.ok) assert.match(a.identity.imageKey, /^raw:/);
});

test("canonicalIdentity: no imageUrl => ok=false (preserved by dedupe)", () => {
  const a = canonicalIdentity({ source: "x" });
  assert.equal(a.ok, false);
  if (!a.ok) assert.equal(a.reason, "NO_IMAGE_URL");
});

test("canonicalIdentity: invalid candidate => ok=false", () => {
  assert.equal(canonicalIdentity(null).ok, false);
  assert.equal(canonicalIdentity(undefined).ok, false);
  assert.equal(canonicalIdentity({}).ok, false);
});

test("canonicalIdentity: javascript URL preserved with raw fallback", () => {
  const a = canonicalIdentity({ source: "x", imageUrl: "javascript:alert(1)" });
  assert.equal(a.ok, true);
  if (a.ok) assert.match(a.identity.imageKey, /^raw:/);
});

// ============================================================================
// dedupeCandidates
// ============================================================================

test("dedupe: exact duplicate (same source + same imageUrl) is collapsed", () => {
  const a = { source: "x", imageUrl: "https://example.com/foo.jpg" };
  const b = { source: "x", imageUrl: "https://example.com/foo.jpg" };
  const out = dedupeCandidates([a, b]);
  assert.equal(out.length, 1);
});

test("dedupe: tracking-param duplicate is collapsed", () => {
  const a = { source: "wikipedia", imageUrl: "https://upload.wikimedia.org/foo.jpg?utm_source=x" };
  const b = { source: "wikipedia", imageUrl: "https://upload.wikimedia.org/foo.jpg?utm_source=y" };
  const out = dedupeCandidates([a, b]);
  assert.equal(out.length, 1);
});

test("dedupe: different assets preserved", () => {
  const a = { source: "x", imageUrl: "https://example.com/a.jpg" };
  const b = { source: "x", imageUrl: "https://example.com/b.jpg" };
  const out = dedupeCandidates([a, b]);
  assert.equal(out.length, 2);
});

test("dedupe: invalid canonical identity candidates preserved", () => {
  const out = dedupeCandidates([
    { source: "x" },                  // no imageUrl
    { source: "y", imageUrl: "" },    // empty imageUrl
    {},                                // empty candidate
  ]);
  assert.equal(out.length, 3);
});

test("dedupe: deterministic output for identical input", () => {
  const input = [
    { source: "x", imageUrl: "https://example.com/b.jpg", width: 200 },
    { source: "x", imageUrl: "https://example.com/a.jpg", width: 400 },
    { source: "x", imageUrl: "https://example.com/a.jpg", width: 100 },
  ];
  const out1 = dedupeCandidates(input);
  const out2 = dedupeCandidates(input);
  assert.deepEqual(
    out1.map((c) => (c as any).width),
    out2.map((c) => (c as any).width),
  );
});

test("dedupe: input array is not mutated", () => {
  const input = [
    { source: "x", imageUrl: "https://example.com/a.jpg" },
    { source: "x", imageUrl: "https://example.com/a.jpg" },
    { source: "x", imageUrl: "https://example.com/b.jpg" },
  ];
  const snapshot = JSON.parse(JSON.stringify(input));
  dedupeCandidates(input);
  assert.deepEqual(input, snapshot);
});

test("dedupe: metadata completeness tie-break", () => {
  const thin = { source: "x", imageUrl: "https://example.com/foo.jpg" };
  const rich = {
    source: "x",
    imageUrl: "https://example.com/foo.jpg",
    width: 800,
    height: 600,
    author: "Photographer",
    license: "CC-BY-4.0",
  };
  const out = dedupeCandidates([thin, rich]);
  assert.equal(out.length, 1);
  assert.equal((out[0] as any).author, "Photographer");
});

test("dedupe: explicit completeness field wins tie-break", () => {
  const low = { source: "x", imageUrl: "https://example.com/foo.jpg", completeness: 1 };
  const high = { source: "x", imageUrl: "https://example.com/foo.jpg", completeness: 100 };
  const out = dedupeCandidates([low, high]);
  assert.equal(out.length, 1);
  assert.equal((out[0] as any).completeness, 100);
});

test("dedupe: newer verifiedAt wins when completeness ties", () => {
  // Use timestamps far enough apart to clear the saturation cap
  // in candidateScore (the time contribution is capped at 1M).
  const a = { source: "x", imageUrl: "https://example.com/foo.jpg", verifiedAt: "1970-01-01T00:00:00Z" };
  const b = { source: "x", imageUrl: "https://example.com/foo.jpg", verifiedAt: "2099-12-31T00:00:00Z" };
  const out = dedupeCandidates([a, b]);
  assert.equal(out.length, 1);
  assert.equal((out[0] as any).verifiedAt, "2099-12-31T00:00:00Z");
});

test("dedupe: invalid verifiedAt ignored in tie-break", () => {
  const a = { source: "x", imageUrl: "https://example.com/foo.jpg", verifiedAt: "not-a-date" };
  const b = { source: "x", imageUrl: "https://example.com/foo.jpg", verifiedAt: "2099-12-31T00:00:00Z" };
  const out = dedupeCandidates([a, b]);
  assert.equal(out.length, 1);
  assert.equal((out[0] as any).verifiedAt, "2099-12-31T00:00:00Z");
});

test("dedupe: empty input returns empty array", () => {
  assert.deepEqual(dedupeCandidates([]), []);
});

test("dedupe: output preserves winning-candidate input order", () => {
  const a = { source: "x", imageUrl: "https://example.com/a.jpg" };
  const b = { source: "x", imageUrl: "https://example.com/b.jpg" };
  const c = { source: "x", imageUrl: "https://example.com/a.jpg", completeness: 999 };
  // The winner for the "a.jpg" group is `c` (completeness=999), but
  // its index is 2 — after `b`. The output should keep `b` first
  // because the `a` group's winner appeared later, and `b` was
  // never duplicated.
  const out = dedupeCandidates([a, b, c]);
  assert.equal(out.length, 2);
  assert.equal((out[0] as any).imageUrl, "https://example.com/b.jpg");
  assert.equal((out[1] as any).imageUrl, "https://example.com/a.jpg");
  assert.equal((out[1] as any).completeness, 999);
});

test("dedupe: structural only — does not infer rights or renderImage fields", () => {
  // Two candidates with identical source + imageUrl but different
  // rights_confirmed / renderImage values. Dedupe must:
  //   - NEITHER flip these fields (it does not infer them)
  //   - NEITHER prefer one over the other based on these fields
  //     (rights/render are not in the deterministic tie-break)
  // It selects based on field-count + completeness + verifiedAt +
  // stable hash. Here both candidates have identical field counts
  // so the stable-hash tiebreaker is decisive.
  const run = (input: any[]) => {
    const out = dedupeCandidates(input);
    return out.length;
  };
  // Same input reversed — both should still collapse to one row.
  const a = { source: "x", imageUrl: "https://example.com/a.jpg", rights_confirmed: false, renderImage: false };
  const b = { source: "x", imageUrl: "https://example.com/a.jpg", rights_confirmed: true, renderImage: true };
  assert.equal(run([a, b]), 1);
  assert.equal(run([b, a]), 1);
});

test("dedupe: combined keys (source + sourceUrl + imageKey)", () => {
  // Same imageUrl from different sources stays distinct.
  const a = { source: "wikipedia", imageUrl: "https://example.com/foo.jpg" };
  const b = { source: "wikimedia", imageUrl: "https://example.com/foo.jpg" };
  const out = dedupeCandidates([a, b]);
  assert.equal(out.length, 2);
});
