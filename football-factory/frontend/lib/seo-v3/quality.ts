// Football Factory — SEO V3 Content Quality Engine (Wave A).
//
// ADVISORY ONLY. Produces a deterministic quality score with
// explicit HARD_BLOCK vs WARNING vs OPPORTUNITY classification.
//
// HARD_BLOCK policy (locked down):
//   - INVALID_CANONICAL: candidate canonical is structurally
//     invalid (NOT a Thai readability / term-count issue).
//   - H1_COUNT: h1 list is not exactly 1 (operator-set policy).
//
// Thai readability / term-count heuristics NEVER hard-block by
// default. They surface as WARNINGS or OPPORTUNITIES so the
// editorial review can decide.

import { getTextAnalyzer, type TextAnalyzer } from "./analyzers";

export type QualityIssueKind = "blocking" | "warning" | "opportunity";

export type QualityIssueCode =
  | "INVALID_CANONICAL"
  | "H1_COUNT"
  | "THIN_CONTENT"
  | "TITLE_LENGTH"
  | "META_LENGTH"
  | "DUPLICATE_HEADING"
  | "META_DUPLICATES_TITLE"
  | "LONG_SENTENCES"
  | "LONG_PARAGRAPH"
  | "KEYWORD_STUFFING_RISK"
  | "REPEATED_PHRASE_RISK"
  | "PROVENANCE_INCOMPLETE"
  | "SCHEMA_INCOMPLETE"
  | "IMAGE_ALT_GAPS"
  | "TITLE_H1_DIFFERENTIATION"
  | "CONTENT_REFRESH"
  | "INTERNAL_LINK_OPPORTUNITY"
  | "AUTHORITATIVE_SOURCE_OPPORTUNITY"
  | "DUPLICATE_CONTENT_SIGNAL";

export interface QualityIssue {
  code: QualityIssueCode;
  kind: QualityIssueKind;
  detail?: string;
}

export interface QualitySignals {
  termCount: number;
  sentenceCount: number;
  averageSentenceLength: number;
  maxParagraphTerms: number;
  keywordOccurrenceRatio: number;
  maxRepeatedTrigram: number;
  freshnessDays: number | null;
  imageAltCoverage: number;
  missingSchema: string[];
  titleH1Duplicate: boolean;
  heuristic: boolean;
}

export interface QualityThresholds {
  minTerms?: number;
  maxTitle?: number;
  minTitle?: number;
  minMeta?: number;
  maxMeta?: number;
  maxAvgSentence?: number;
  maxParagraphTerms?: number;
  stuffingRatio?: number;
  repeatedPhraseLimit?: number;
  freshDays?: number;
  minInternalLinks?: number;
  requireExternalAuthority?: boolean;
  requiredSchemaByPageType?: Record<string, readonly string[]>;
}

export interface QualityInput {
  title?: string;
  meta?: string;
  h1?: readonly string[];
  h2?: readonly string[];
  body?: string;
  targetKeyword?: string;
  canonicalValid?: boolean;
  sourceComplete?: boolean;
  images?: readonly { alt?: string }[];
  schemaTypes?: readonly string[];
  internalLinks?: number;
  hasAuthoritativeExternalSource?: boolean;
  duplicateContentSignal?: boolean;
  updatedAt?: string;
  pageType?: string;
  locale?: string;
  textAnalyzer?: TextAnalyzer;
}

export interface QualityResult {
  score: number;
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  opportunities: QualityIssue[];
  recommendations: string[];
  signals: QualitySignals;
  policyVersion: string;
}

const DEFAULTS = {
  minTerms: 300,
  maxTitle: 65,
  minTitle: 20,
  minMeta: 70,
  maxMeta: 170,
  maxAvgSentence: 30,
  maxParagraphTerms: 140,
  stuffingRatio: 0.04,
  repeatedPhraseLimit: 4,
  freshDays: 180,
  minInternalLinks: 1,
  requireExternalAuthority: false,
} as const;

function norm(s: string | undefined | null): string {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function phraseRisk(body: string): number {
  const toks = norm(body).split(/\s+/).filter(Boolean);
  const grams = new Map<string, number>();
  for (let i = 0; i < toks.length - 2; i++) {
    const g = toks.slice(i, i + 3).join(" ");
    grams.set(g, (grams.get(g) || 0) + 1);
  }
  if (grams.size === 0) return 0;
  return Math.max(0, ...grams.values());
}

function ok(code: QualityIssueCode, kind: QualityIssueKind, detail?: string): QualityIssue {
  return detail === undefined ? { code, kind } : { code, kind, detail };
}

/**
 * Deterministic quality scorer. Pure; no I/O; never throws.
 * Returns a structured result suitable for advisory UI.
 */
export function scoreContent(
  input: QualityInput,
  thresholds: QualityThresholds = {},
): QualityResult {
  const c = { ...DEFAULTS, ...thresholds };
  const a = input.textAnalyzer ?? getTextAnalyzer(input.locale || "en");

  let score = 100;
  const blockingIssues: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const opportunities: QualityIssue[] = [];
  const recommendations: string[] = [];

  const body = String(input.body || "");
  const terms = a.countTerms(body);
  const sentenceCount = a.sentenceCount(body);
  const avg = a.averageSentenceLength(body);
  const paras = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const maxPara = paras.length ? Math.max(...paras.map((p) => a.countTerms(p))) : 0;

  // HARD-BLOCK: invalid canonical.
  if (input.canonicalValid === false) {
    score -= 25;
    blockingIssues.push(ok("INVALID_CANONICAL", "blocking"));
  }
  // HARD-BLOCK: H1 count policy (operator-mandated exactly 1).
  const h1Count = (input.h1 || []).length;
  if (h1Count !== 1) {
    score -= 15;
    blockingIssues.push(ok("H1_COUNT", "blocking", `h1Count=${h1Count}`));
  }
  // WARNING: thin content.
  if (terms < c.minTerms) {
    score -= 12;
    warnings.push(ok("THIN_CONTENT", "warning"));
    recommendations.push("Increase useful content depth");
  }
  // WARNING: title length.
  const tlen = (input.title || "").length;
  if (tlen < c.minTitle || tlen > c.maxTitle) {
    score -= 6;
    warnings.push(ok("TITLE_LENGTH", "warning", `tlen=${tlen}`));
  }
  // WARNING: meta length.
  const mlen = (input.meta || "").length;
  if (mlen < c.minMeta || mlen > c.maxMeta) {
    score -= 5;
    warnings.push(ok("META_LENGTH", "warning", `mlen=${mlen}`));
  }
  // WARNING: duplicate heading.
  const headings = [...(input.h1 || []), ...(input.h2 || [])].map(norm);
  if (new Set(headings).size < headings.length) {
    score -= 5;
    warnings.push(ok("DUPLICATE_HEADING", "warning"));
  }
  // OPPORTUNITY: title vs H1.
  if (input.h1?.[0] && norm(input.title) === norm(input.h1[0])) {
    opportunities.push(ok("TITLE_H1_DIFFERENTIATION", "opportunity"));
  }
  // WARNING: meta duplicates title.
  if (input.meta && input.title && norm(input.meta) === norm(input.title)) {
    score -= 3;
    warnings.push(ok("META_DUPLICATES_TITLE", "warning"));
  }
  // WARNING: long sentences (heuristic — English only).
  if (!a.heuristic && avg > c.maxAvgSentence) {
    score -= 5;
    warnings.push(ok("LONG_SENTENCES", "warning", `avg=${avg.toFixed(1)}`));
  }
  // WARNING: long paragraph.
  if (maxPara > c.maxParagraphTerms) {
    score -= 4;
    warnings.push(ok("LONG_PARAGRAPH", "warning", `maxPara=${maxPara}`));
  }
  // WARNING: keyword stuffing.
  const target = norm(input.targetKeyword);
  const bodyNorm = norm(body);
  const occurrences = target ? bodyNorm.split(target).length - 1 : 0;
  const ratio = terms > 0 ? occurrences / terms : 0;
  if (target && ratio > c.stuffingRatio) {
    score -= 8;
    warnings.push(ok("KEYWORD_STUFFING_RISK", "warning", `ratio=${ratio.toFixed(3)}`));
  }
  // WARNING: repeated phrase risk.
  const repeat = phraseRisk(body);
  if (repeat > c.repeatedPhraseLimit) {
    score -= 5;
    warnings.push(ok("REPEATED_PHRASE_RISK", "warning", `maxTrigram=${repeat}`));
  }
  // OPPORTUNITY: freshness.
  let age: number | null = null;
  if (input.updatedAt) {
    const t = new Date(input.updatedAt).getTime();
    if (!Number.isNaN(t)) {
      age = Math.max(0, (Date.now() - t) / 86400000);
      if (age > c.freshDays) {
        score -= 4;
        opportunities.push(ok("CONTENT_REFRESH", "opportunity", `ageDays=${Math.round(age)}`));
      }
    }
  }
  // WARNING: provenance incomplete.
  if (input.sourceComplete === false) {
    score -= 7;
    warnings.push(ok("PROVENANCE_INCOMPLETE", "warning"));
  }
  // WARNING: schema completeness by page type.
  const required = (c.requiredSchemaByPageType || {})[input.pageType || ""] || [];
  const have = new Set(input.schemaTypes || []);
  const missingSchema = required.filter((x) => !have.has(x));
  if (missingSchema.length > 0) {
    score -= 8;
    warnings.push(ok("SCHEMA_INCOMPLETE", "warning", `missing=${missingSchema.join(",")}`));
  }
  // WARNING: image alt coverage.
  const imgs = input.images || [];
  const coverage =
    imgs.length === 0
      ? 1
      : imgs.filter((x) => String(x?.alt || "").trim().length > 0).length / imgs.length;
  if (coverage < 1) {
    score -= Math.ceil((1 - coverage) * 8);
    warnings.push(ok("IMAGE_ALT_GAPS", "warning", `coverage=${coverage.toFixed(2)}`));
  }
  // OPPORTUNITY: internal links.
  if ((input.internalLinks ?? 0) < c.minInternalLinks) {
    score -= 5;
    opportunities.push(ok("INTERNAL_LINK_OPPORTUNITY", "opportunity"));
  }
  // OPPORTUNITY: authoritative external source (off by default).
  if (c.requireExternalAuthority && !input.hasAuthoritativeExternalSource) {
    score -= 4;
    opportunities.push(ok("AUTHORITATIVE_SOURCE_OPPORTUNITY", "opportunity"));
  }
  // WARNING: duplicate content signal.
  if (input.duplicateContentSignal === true) {
    score -= 8;
    warnings.push(ok("DUPLICATE_CONTENT_SIGNAL", "warning"));
  }

  const signals: QualitySignals = {
    termCount: terms,
    sentenceCount,
    averageSentenceLength: avg,
    maxParagraphTerms: maxPara,
    keywordOccurrenceRatio: ratio,
    maxRepeatedTrigram: repeat,
    freshnessDays: age,
    imageAltCoverage: coverage,
    missingSchema: [...missingSchema],
    titleH1Duplicate: !!(input.h1?.[0] && norm(input.title) === norm(input.h1[0])),
    heuristic: a.heuristic,
  };

  return {
    score: Math.max(0, Math.round(score)),
    blockingIssues,
    warnings,
    opportunities,
    recommendations,
    signals,
    policyVersion: "1",
  };
}
