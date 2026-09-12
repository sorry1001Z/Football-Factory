// Football Factory — SEO V3 content quality + Thai analyzer tests (Wave A).

import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreContent } from "../quality";
import {
  EnglishTextAnalyzer,
  ThaiTextAnalyzer,
  getTextAnalyzer,
} from "../analyzers";

const baseContent = {
  title: "A useful sufficiently long title here",
  meta: "This is a sufficiently descriptive meta description intended for deterministic quality testing.",
  h1: ["Heading"],
  h2: [],
  body: "word ".repeat(350),
  canonicalValid: true,
  sourceComplete: true,
  images: [],
  schemaTypes: [],
  internalLinks: 1,
};

test("quality: deterministic for identical inputs", () => {
  assert.deepEqual(scoreContent(baseContent), scoreContent(baseContent));
});

test("quality: invalid canonical blocking", () => {
  const r = scoreContent({ ...baseContent, title: "x", meta: "x", h1: ["x"], canonicalValid: false });
  assert.ok(r.blockingIssues.some((i) => i.code === "INVALID_CANONICAL"));
});

test("quality: H1 count blocking (zero h1)", () => {
  const r = scoreContent({ ...baseContent, h1: [] });
  assert.ok(r.blockingIssues.some((i) => i.code === "H1_COUNT"));
});

test("quality: H1 count blocking (two h1)", () => {
  const r = scoreContent({ ...baseContent, h1: ["a", "b"] });
  assert.ok(r.blockingIssues.some((i) => i.code === "H1_COUNT"));
});

test("quality: thin content warns (not blocks)", () => {
  const r = scoreContent(
    { ...baseContent, body: "one two" },
    { minTerms: 3 },
  );
  assert.equal(r.blockingIssues.length, 0);
  assert.ok(r.warnings.some((i) => i.code === "THIN_CONTENT"));
});

test("quality: image alt coverage", () => {
  const r = scoreContent({
    ...baseContent,
    images: [{ alt: "x" }, {}],
  });
  assert.equal(r.signals.imageAltCoverage, 0.5);
});

test("quality: freshness opportunity", () => {
  const r = scoreContent({ ...baseContent, updatedAt: "2020-01-01T00:00:00Z" });
  assert.ok(r.opportunities.some((i) => i.code === "CONTENT_REFRESH"));
});

test("quality: schema by page type warns", () => {
  const r = scoreContent(
    { ...baseContent, pageType: "detail" },
    { requiredSchemaByPageType: { detail: ["Thing"] } },
  );
  assert.ok(r.warnings.some((i) => i.code === "SCHEMA_INCOMPLETE"));
});

test("quality: keyword stuffing risk", () => {
  const r = scoreContent(
    { ...baseContent, body: "alpha ".repeat(100), targetKeyword: "alpha" },
    { minTerms: 1 },
  );
  assert.ok(r.warnings.some((i) => i.code === "KEYWORD_STUFFING_RISK"));
});

test("quality: meta duplicates title warns", () => {
  const r = scoreContent({
    ...baseContent,
    title: "abc def ghi jkl mno pqr stu",
    meta: "abc def ghi jkl mno pqr stu",
  });
  assert.ok(r.warnings.some((i) => i.code === "META_DUPLICATES_TITLE"));
});

test("quality: title length warns", () => {
  const r = scoreContent({ ...baseContent, title: "short" });
  assert.ok(r.warnings.some((i) => i.code === "TITLE_LENGTH"));
});

test("quality: NEVER hard-block on Thai heuristic alone", () => {
  // Even when the Thai analyzer is used and the term count is
  // very low (heuristic undercount), no blocking issue is added
  // by default.
  const r = scoreContent({
    ...baseContent,
    locale: "th-TH",
    body: "ข่าวแมนยูวันนี้",
  });
  // Should NOT include any HARD_BLOCK solely from Thai heuristics.
  const blockingFromThai = r.blockingIssues.filter(
    (i) => i.code === "THIN_CONTENT" || i.code === "LONG_SENTENCES" || i.code === "LONG_PARAGRAPH",
  );
  assert.equal(blockingFromThai.length, 0, `unexpected hard-block: ${JSON.stringify(blockingFromThai)}`);
});

// ----- Thai analyzer -----

test("thai analyzer: locale is th", () => {
  assert.equal(getTextAnalyzer("th-TH").locale, "th");
  assert.equal(getTextAnalyzer("th").locale, "th");
});

test("thai analyzer: not whitespace only", () => {
  assert.ok(ThaiTextAnalyzer.countTerms("พรีเมียร์ลีกวันนี้มีการแข่งขัน") > 1);
});

test("thai analyzer: labeled heuristic", () => {
  assert.equal(ThaiTextAnalyzer.heuristic, true);
});

test("english analyzer: heuristic=false", () => {
  assert.equal(EnglishTextAnalyzer.heuristic, false);
});

test("english analyzer: counts terms", () => {
  assert.equal(EnglishTextAnalyzer.countTerms("one two three"), 3);
});

test("thai analyzer: empty string returns 0", () => {
  assert.equal(ThaiTextAnalyzer.countTerms(""), 0);
});

test("thai analyzer: whitespace-only returns 0", () => {
  assert.equal(ThaiTextAnalyzer.countTerms("   "), 0);
});
