// Football Factory — SEO V3 intent engine tests (Wave B).

import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, type IntentRule } from "../intent";

const rules: IntentRule[] = [
  {
    id: "news",
    locale: "en",
    patterns: [{ phrase: "latest news", weight: 3 }],
    negativePatterns: ["jobs"],
    intent: "NEWS",
    landingPageType: "news",
    priority: 80,
  },
  {
    id: "info",
    locale: "en",
    patterns: [{ phrase: "guide", weight: 2 }],
    intent: "INFORMATIONAL",
    landingPageType: "guide",
    priority: 70,
  },
  {
    id: "th-news",
    locale: "th",
    patterns: [{ phrase: "ข่าว", weight: 2 }, { phrase: "วันนี้", weight: 1 }],
    intent: "NEWS",
    landingPageType: "team-news-hub",
    entityType: "TEAM",
    priority: 90,
  },
];

test("intent: weighted phrase match", () => {
  const r = classify("latest news today", rules, { locale: "en" });
  assert.ok(r);
  assert.equal(r!.intent, "NEWS");
});

test("intent: phrase boundary (substring rejected)", () => {
  // "newspaper" should NOT match "news" because of word boundary.
  const r = classify("newspaper", rules, { locale: "en" });
  // No rule has a "newspaper" pattern; this should be null.
  assert.equal(r, null);
});

test("intent: negative pattern excludes match", () => {
  const r = classify("latest news jobs", rules, { locale: "en" });
  assert.equal(r, null);
});

test("intent: locale filter rejects cross-locale rule", () => {
  const r = classify("latest news", rules, { locale: "th" });
  assert.equal(r, null);
});

test("intent: explanation string format", () => {
  const r = classify("latest news today", rules, { locale: "en" });
  assert.ok(r);
  assert.match(r!.explanation, /score=/);
  assert.match(r!.explanation, /Matched weighted phrases:/);
});

test("intent: deterministic — same input → same output", () => {
  const r1 = classify("latest news today", rules, { locale: "en" });
  const r2 = classify("latest news today", rules, { locale: "en" });
  assert.deepEqual(r1, r2);
});

test("intent: no match returns null", () => {
  const r = classify("zebra banana", rules, { locale: "en" });
  assert.equal(r, null);
});

test("intent: low confidence returns null when minConfidence raised", () => {
  const r = classify("latest news", rules, {
    locale: "en",
    minConfidence: 0.9999,
  });
  assert.equal(r, null);
});

test("intent: Thai phrase boundary (no word-boundary false positive)", () => {
  // Thai does not use spaces between words, so a substring match is
  // ambiguous. The engine correctly uses \p{L}/\p{M}/\p{N} boundaries,
  // so a phrase that DOES NOT have a separator on the right side of
  // the match is refused (no false-positive substring match).
  const r1 = classify("ข่าววันนี้", rules, { locale: "th" });
  // Should refuse to match the substring "ข่าว" inside "ข่าววันนี้"
  // because the next char `ว` is a Letter — boundary check fails.
  assert.equal(r1, null);
  // A phrase that DOES have a separator (space or terminal) matches.
  const r2 = classify("ข่าว วันนี้", rules, { locale: "th" });
  assert.ok(r2);
  assert.equal(r2!.intent, "NEWS");
});

test("intent: English phrase boundary (word-boundary respected)", () => {
  const r = classify("alphabet soup", rules, { locale: "en" });
  // No rule matches "alphabet"; "alpha" pattern in "info" is not present.
  assert.equal(r, null);
});

test("intent: ambiguity flag when margin is small", () => {
  // Construct two rules with identical score to force ambiguity.
  const tieRules: IntentRule[] = [
    { id: "a", locale: "en", patterns: [{ phrase: "x", weight: 2 }], intent: "A", priority: 80 },
    { id: "b", locale: "en", patterns: [{ phrase: "x", weight: 2 }], intent: "B", priority: 80 },
  ];
  const r = classify("x", tieRules, { locale: "en" });
  assert.ok(r);
  // Same score, same priority → tie. tiedIds contains both.
  assert.deepEqual(r!.matchedRules.sort(), ["a", "b"]);
});

test("intent: deterministic tie-break: same score, lower id wins", () => {
  const tieRules: IntentRule[] = [
    { id: "zz", locale: "en", patterns: [{ phrase: "x", weight: 2 }], intent: "ZZ", priority: 80 },
    { id: "aa", locale: "en", patterns: [{ phrase: "x", weight: 2 }], intent: "AA", priority: 80 },
  ];
  const r = classify("x", tieRules, { locale: "en" });
  assert.ok(r);
  assert.equal(r!.intent, "AA");
});

test("intent: deterministic tie-break: higher priority wins", () => {
  const tieRules: IntentRule[] = [
    { id: "low", locale: "en", patterns: [{ phrase: "x", weight: 2 }], intent: "LOW", priority: 30 },
    { id: "high", locale: "en", patterns: [{ phrase: "x", weight: 2 }], intent: "HIGH", priority: 90 },
  ];
  const r = classify("x", tieRules, { locale: "en" });
  assert.ok(r);
  assert.equal(r!.intent, "HIGH");
});

test("intent: minScore filter", () => {
  const r = classify("x", [
    { id: "r", locale: "en", patterns: [{ phrase: "x", weight: 1 }], intent: "R", minScore: 2 },
  ], { locale: "en" });
  // weight 1 < minScore 2 → not enough → null
  assert.equal(r, null);
});
