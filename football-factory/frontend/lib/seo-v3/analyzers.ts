// Football Factory — SEO V3 Text Analyzers (Wave A).
//
// Heuristic Thai analyzer preserved for compatibility with the
// external R2 package. The Thai analyzer is labeled `heuristic`
// confidence and MUST NOT be the sole basis for a HARD_BLOCK.
//
// Deterministic English analyzer uses Unicode word boundaries
// (`\p{L}\p{N}`) so it is safe for both ASCII and Thai.

export type AnalyzerLocale = "en" | "th" | string;

export interface TextAnalyzer {
  locale: string;
  /** Heuristic signal — `false` for English regex, `true` for Thai approximation. */
  heuristic: boolean;
  countTerms(text: string): number;
  sentenceCount(text: string): number;
  averageSentenceLength(text: string): number;
  readabilitySignals(text: string): {
    averageSentenceLength: number;
    longSentenceRisk: boolean;
  };
}

function splitSentences(text: string): string[] {
  // English + Thai sentence terminators. Splits after . ! ? 。 ！
  const s = String(text);
  return s
    .split(/(?<=[.!?。！？])\s*/u)
    .map((x) => x.trim())
    .filter(Boolean);
}

export const EnglishTextAnalyzer: TextAnalyzer = {
  locale: "en",
  heuristic: false,
  countTerms(t: string): number {
    const s = String(t || "").toLowerCase();
    const matches = s.match(/\b[\p{L}\p{N}'’\-]+\b/gu);
    return matches ? matches.length : 0;
  },
  sentenceCount(t: string): number {
    return Math.max(1, splitSentences(t).length);
  },
  averageSentenceLength(t: string): number {
    const c = EnglishTextAnalyzer.countTerms(t);
    const s = EnglishTextAnalyzer.sentenceCount(t);
    return c / s;
  },
  readabilitySignals(t: string): { averageSentenceLength: number; longSentenceRisk: boolean } {
    const a = EnglishTextAnalyzer.averageSentenceLength(t);
    return { averageSentenceLength: a, longSentenceRisk: a > 28 };
  },
};

export const ThaiTextAnalyzer: TextAnalyzer = {
  locale: "th",
  heuristic: true,
  countTerms(t: string): number {
    const s = String(t || "").replace(/\s+/g, " ").trim();
    if (!s) return 0;
    const thai = (s.match(/[\u0E00-\u0E7F]+/g) || []).join("");
    const latin = (s.match(/\b[A-Za-z0-9]+\b/g) || []).length;
    // Deterministic approximation: Thai orthographic clusters, isolated
    // behind the analyzer contract. NOT a real Thai word-segmenter.
    const clusters =
      (thai.match(/[ก-ฮ][\u0E31-\u0E4E]*[ะาำิีึืุูเแโใไๅๆ]*[\u0E31-\u0E4E]*/g) ||
        []).length;
    return Math.max(clusters, Math.ceil(thai.length / 5)) + latin;
  },
  sentenceCount(t: string): number {
    return Math.max(1, splitSentences(t).length);
  },
  averageSentenceLength(t: string): number {
    const c = ThaiTextAnalyzer.countTerms(t);
    const s = ThaiTextAnalyzer.sentenceCount(t);
    return c / s;
  },
  readabilitySignals(t: string): { averageSentenceLength: number; longSentenceRisk: boolean } {
    const a = ThaiTextAnalyzer.averageSentenceLength(t);
    return { averageSentenceLength: a, longSentenceRisk: a > 35 };
  },
};

export function getTextAnalyzer(locale: AnalyzerLocale = "en"): TextAnalyzer {
  return String(locale).toLowerCase().startsWith("th")
    ? ThaiTextAnalyzer
    : EnglishTextAnalyzer;
}
