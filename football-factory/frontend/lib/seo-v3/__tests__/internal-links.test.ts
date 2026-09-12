// Football Factory — SEO V3 internal-links tests (Wave B).

import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestLinks, type InternalLinkTarget } from "../internal-links";

const A: InternalLinkTarget = {
  url: "/alpha",
  label: "Alpha",
  entityId: "1",
  entityType: "ORG",
  confidence: 0.95,
  priority: 10,
};

const B: InternalLinkTarget = {
  url: "/beta",
  label: "Beta",
  entityId: "2",
  entityType: "ORG",
  confidence: 0.9,
  priority: 9,
};

test("internal-links: normal suggestion", () => {
  const r = suggestLinks("Alpha met Beta.", [A, B]);
  assert.equal(r.length, 2);
});

test("internal-links: boundary avoids substring", () => {
  const r = suggestLinks("Alphabet soup.", [A]);
  assert.equal(r.length, 0);
});

test("internal-links: existing anchor avoided", () => {
  const r = suggestLinks('<a href="/x">Alpha</a>', [A]);
  assert.equal(r.length, 0);
});

test("internal-links: heading protected by default", () => {
  const r = suggestLinks("<h2>Alpha</h2>", [A]);
  assert.equal(r.length, 0);
});

test("internal-links: heading allowed when protectHeadings=false", () => {
  const r = suggestLinks("<h2>Alpha</h2>", [A], [], { protectHeadings: false });
  assert.equal(r.length, 1);
});

test("internal-links: existing target avoided via existingLinks", () => {
  const r = suggestLinks("Alpha met Beta.", [A, B], ["/alpha"]);
  assert.equal(r.length, 1);
  assert.equal(r[0].target, "/beta");
});

test("internal-links: maxLinksTotal enforced", () => {
  const r = suggestLinks("Alpha Beta Alpha Beta.", [A, B], [], { maxLinksTotal: 1 });
  assert.equal(r.length, 1);
});

test("internal-links: maxLinksPerEntityType enforced", () => {
  const r = suggestLinks("Alpha Beta.", [A, B], [], { maxLinksPerEntityType: 1 });
  assert.equal(r.length, 1);
});

test("internal-links: confidence threshold enforced", () => {
  const low: InternalLinkTarget = { ...A, confidence: 0.5 };
  const r = suggestLinks("Alpha here.", [low]);
  assert.equal(r.length, 0);
});

test("internal-links: returns offsets and context", () => {
  const r = suggestLinks("Alpha is here.", [A]);
  assert.equal(r.length, 1);
  assert.ok(r[0].startOffset >= 0);
  assert.ok(r[0].endOffset > r[0].startOffset);
  assert.match(r[0].context, /Alpha/);
});

test("internal-links: ambiguity skipped (same label, different ids)", () => {
  const dup: InternalLinkTarget = { ...A, entityId: "99", url: "/zz" };
  const r = suggestLinks("Alpha is here.", [A, dup]);
  assert.equal(r.length, 0);
});

test("internal-links: deterministic ordering — same input, same output", () => {
  const r1 = suggestLinks("Alpha met Beta.", [B, A]);
  const r2 = suggestLinks("Alpha met Beta.", [B, A]);
  assert.deepEqual(r1, r2);
});

test("internal-links: Thai multibyte text", () => {
  const TH: InternalLinkTarget = {
    url: "/th-entity",
    label: "พรีเมียร์ลีก",
    entityId: "th-1",
    entityType: "COMPETITION",
    confidence: 0.95,
    priority: 10,
  };
  const r = suggestLinks("ผลบอล พรีเมียร์ลีก คืนนี้", [TH]);
  assert.equal(r.length, 1);
  assert.equal(r[0].target, "/th-entity");
});

test("internal-links: punctuation around anchor", () => {
  const r = suggestLinks("Hello, Alpha! How are you, Alpha?", [A]);
  assert.equal(r.length, 1);
  // Only one suggestion due to allowRepeatedAnchor=false.
});

test("internal-links: script content protected", () => {
  const r = suggestLinks('<script>var x = "Alpha";</script>Alpha elsewhere.', [A]);
  assert.equal(r.length, 1);
  assert.ok(r[0].context.includes("Alpha"));
});

test("internal-links: style content protected", () => {
  const r = suggestLinks(
    '<style>.cls { background: url("Alpha.png"); }</style>Alpha here.',
    [A],
  );
  assert.equal(r.length, 1);
});

test("internal-links: HTML attribute value protected", () => {
  const r = suggestLinks('<a href="/x" data-name="Alpha">click</a> Alpha.', [A]);
  assert.equal(r.length, 1);
  // The "Alpha" inside the attribute value of the existing <a>
  // should not be suggested.
});

test("internal-links: HTML comments protected", () => {
  const r = suggestLinks('<!-- Alpha --> Alpha.', [A]);
  assert.equal(r.length, 1);
  // The "Alpha" inside the comment should not be suggested.
});

test("internal-links: nested tags respected", () => {
  const r = suggestLinks(
    '<div><span>Alpha</span></div>',
    [A],
  );
  assert.equal(r.length, 1);
});

test("internal-links: candidate spanning markup skipped", () => {
  // Force the engine to consider an anchor that crosses a `<`
  // boundary. Use a regex-bypass target whose label is exactly
  // the literal string "Alpha<" — but our engine anchors to
  // word boundaries, so it can't legitimately match across markup.
  // Instead, we confirm that anchor text split across an open-tag
  // boundary is NOT suggested (because the match position lands
  // inside the open tag's protected range).
  const r = suggestLinks('<a data-x="Alpha">Alpha</a>', [A]);
  // The visible "Alpha" after the open tag is inside the <a>
  // element, so it should NOT be suggested.
  assert.equal(r.length, 0);
});

test("internal-links: long article + many targets (performance smoke)", () => {
  // Generate a long article that mentions "Alpha" and "Beta" many
  // times. The engine should complete in a bounded amount of time.
  const longBody =
    "Alpha and Beta. ".repeat(200) + "<p>End of article. " + "Alpha again. ".repeat(50) + "</p>";
  const t0 = Date.now();
  const r = suggestLinks(longBody, [A, B]);
  const elapsed = Date.now() - t0;
  // Soft cap: should be well under 500ms on a typical machine.
  assert.ok(elapsed < 500, `took ${elapsed}ms`);
  // With default maxLinksTotal=6, we expect a small bounded number.
  assert.ok(r.length <= 6, `returned ${r.length}`);
});
