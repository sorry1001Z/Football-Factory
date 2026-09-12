// Football Factory — SEO V3 Keyword Intent Engine (Wave B).
//
// Generic, domain-neutral keyword intent classifier. Output is
// ADVISORY. Football-specific rules belong later in the
// FootballSeoAdapter (which the domain adapter contract
// already exposes).
//
// Capabilities:
//   - weighted phrase rules
//   - phrase boundaries via Unicode `\p{L}\p{N}`
//   - negative-pattern exclusion
//   - locale filter (`locale: 'en' | 'th' | …`)
//   - deterministic tie-break (points DESC, priority DESC, id lex)
//   - confidence score (0..1) + explanation
//   - ambiguous-result detection
//   - low-confidence handling: returns null below a threshold
//
// Locale: NFKC-normalised, lowercase, non-letter/digit punctuation
// replaced with a single space. This is safe for English AND Thai.

export type Locale = "en" | "th" | string;

export interface IntentPattern {
  /** Phrase to match (case-insensitive, locale-normalised). */
  phrase: string;
  /** Weight for this pattern; default 1. */
  weight?: number;
}

export interface IntentRule {
  id: string;
  /** If set, the rule is only applied to this locale. */
  locale?: Locale;
  patterns: IntentPattern[] | string[];
  /** Optional list of phrases that DISQUALIFY the rule if matched. */
  negativePatterns?: string[];
  intent: string;
  /** Optional entity type hint. */
  entityType?: string;
  /** Optional pre-resolved entity id hint. */
  entityId?: string;
  /** Optional landing-page type hint. */
  landingPageType?: string;
  /** Optional priority; default 50. Higher wins ties. */
  priority?: number;
  /** Optional minimum score required for this rule to fire; default 1. */
  minScore?: number;
}

export interface IntentMatch {
  rule: IntentRule;
  points: number;
  matched: string[];
}

export interface IntentClassification {
  keyword: string;
  intent: string;
  entityType?: string;
  entityId?: string;
  landingPageType?: string;
  priority: number;
  /** 0..1 (clamped). Reflects the relative margin over the runner-up. */
  confidence: number;
  /** IDs of rules that tied at the top score. */
  matchedRules: string[];
  /** Human-readable explanation. NEVER thrown; always a string. */
  explanation: string;
  locale: Locale;
  /** True when the top two rules are within `AMBIGUITY_MARGIN` of each other. */
  ambiguous: boolean;
}

const AMBIGUITY_MARGIN = 0.5;

function normalize(text: string, locale: Locale): string {
  // Preserve Thai (and other languages that use combining marks):
  // the character categories we keep include Letters (L), Marks (M),
  // Numbers (N), whitespace, and the hyphen-minus connector. Without
  // Marks, Thai diacritics like \u0E48 (mai ek) would be stripped and
  // the cluster broken into separate tokens, breaking phrase
  // matching.
  return String(text || "")
    .normalize("NFKC")
    .toLocaleLowerCase(locale)
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseMatch(text: string, phrase: string): boolean {
  // Word-boundary check via Unicode categories. The phrase must
  // appear as a contiguous token between non-letter/non-digit
  // characters (or at the start/end of the text).
  const p = escapeRegex(normalize(phrase, "en"));
  if (!p) return false;
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${p}(?:$|[^\\p{L}\\p{N}])`, "u").test(text);
}

export interface ClassifyOptions {
  locale?: Locale;
  /** Minimum confidence required to return a result; below this, return null. */
  minConfidence?: number;
}

/**
 * Classify a keyword against a list of intent rules. Pure; never
 * throws; returns `null` when no rule matches OR when the top
 * match falls below `minConfidence`.
 */
export function classify(
  keyword: string,
  rules: IntentRule[],
  options: ClassifyOptions = {},
): IntentClassification | null {
  const locale = (options.locale ?? "en") as Locale;
  const minConfidence = options.minConfidence ?? 0;
  const text = normalize(keyword, locale);
  if (!text) return null;

  const scored: IntentMatch[] = [];
  for (const r of rules) {
    if (r.locale && r.locale !== locale) continue;
    if ((r.negativePatterns || []).some((p) => phraseMatch(text, p))) continue;
    const matched: string[] = [];
    let points = 0;
    for (const p of r.patterns || []) {
      const phrase = typeof p === "string" ? p : p.phrase;
      const w = typeof p === "string" ? 1 : (p.weight ?? 1);
      if (phraseMatch(text, phrase)) {
        points += w;
        matched.push(phrase);
      }
    }
    if (points > 0 && points >= (r.minScore ?? 1)) {
      scored.push({ rule: r, points, matched });
    }
  }
  if (scored.length === 0) return null;

  // Deterministic tie-break: points DESC, priority DESC, id lex ASC.
  scored.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const bp = b.rule.priority ?? 50;
    const ap = a.rule.priority ?? 50;
    if (bp !== ap) return bp - ap;
    return String(a.rule.id).localeCompare(String(b.rule.id));
  });

  const top = scored[0];
  const second = scored[1]?.points ?? 0;
  const margin = Math.max(0, top.points - second);
  const confidence = clamp01(0.5 + top.points * 0.08 + margin * 0.04);
  const ambiguous = scored.length > 1 && margin < AMBIGUITY_MARGIN;

  if (confidence < minConfidence) return null;

  const tiedIds = scored.filter((s) => s.points === top.points).map((s) => s.rule.id);

  return {
    keyword,
    intent: top.rule.intent,
    entityType: top.rule.entityType,
    entityId: top.rule.entityId,
    landingPageType: top.rule.landingPageType,
    priority: top.rule.priority ?? 50,
    confidence: round2(confidence),
    matchedRules: tiedIds,
    explanation: `Matched weighted phrases: ${top.matched.join(", ")}; score=${top.points}; margin=${margin}; locale=${locale}`,
    locale,
    ambiguous,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
