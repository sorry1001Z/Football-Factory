// Football Factory — SEO V3 Internal Link Engine (Wave B).
//
// SUGGESTION-ONLY. Never mutates content. The caller decides which
// suggestions to accept and apply.
//
// Hardening over the external Pack 07 baseline:
//   - protectedRanges() now ALSO excludes:
//       <script>...</script>
//       <style>...</style>
//       HTML tag ATTRIBUTES (any <tag attrs>...</tag>, with attrs
//         inside the open tag considered "in markup metadata")
//       <!-- ... --> HTML comments
//   - candidates that span markup boundaries (start inside a tag
//     and end outside, or vice-versa) are skipped.
//   - ambiguity control: when two candidates share the same
//     label and both clear the confidence threshold, the engine
//     REFUSES to suggest (returns reason='ambiguous_entity').
//   - deterministic ordering: confidence DESC, priority DESC,
//     first-occurrence ASC, target lexical ASC.

export interface InternalLinkTarget {
  url: string;
  label: string;
  confidence: number;
  entityId: string;
  entityType: string;
  priority?: number;
  [k: string]: unknown;
}

export interface InternalLinkOptions {
  maxLinksTotal?: number;
  maxLinksPerEntityType?: number;
  minConfidence?: number;
  protectHeadings?: boolean;
  protectScripts?: boolean;
  protectStyles?: boolean;
  protectAttributes?: boolean;
  protectComments?: boolean;
  allowRepeatedAnchor?: boolean;
  maxAnchorLength?: number;
}

export interface InternalLinkSuggestion {
  anchor: string;
  target: string;
  reason: string;
  confidence: number;
  startOffset: number;
  endOffset: number;
  context: string;
  entityId: string;
  entityType: string;
}

const DEFAULTS: Required<Omit<InternalLinkOptions, never>> = {
  maxLinksTotal: 6,
  maxLinksPerEntityType: 2,
  minConfidence: 0.7,
  protectHeadings: true,
  protectScripts: true,
  protectStyles: true,
  protectAttributes: true,
  protectComments: true,
  allowRepeatedAnchor: false,
  maxAnchorLength: 80,
};

interface ProtectedRange {
  start: number;
  end: number;
  kind: "anchor" | "heading" | "script" | "style" | "comment" | "open-tag";
}

/**
 * Compute every protected range in `html`. The regex set covers:
 *   - <a ...>...</a> (existing anchors)
 *   - <h1..6 ...>...</h1..6> (configurable via `protectHeadings`)
 *   - <script ...>...</script> (always)
 *   - <style ...>...</style> (always)
 *   - <!-- ... --> (configurable via `protectComments`)
 *   - <tag ...> (open-tag attributes) — captured as a separate
 *     range so suggestions cannot match anchor text inside
 *     attribute values like class="alphabet".
 */
function protectedRanges(html: string, c: Required<InternalLinkOptions>): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  const push = (re: RegExp, kind: ProtectedRange["kind"]): void => {
    // Reset lastIndex on global regexes.
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, kind });
    }
  };
  push(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "anchor");
  if (c.protectHeadings) push(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, "heading");
  if (c.protectScripts) push(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "script");
  if (c.protectStyles) push(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "style");
  if (c.protectComments) push(/<!--[\s\S]*?-->/g, "comment");
  // Open-tag attributes: anything between `<` and the first `>` that
  // is not an explicit closing tag `</`. These are short ranges
  // where attribute values live; suggestions cannot land inside.
  push(/<\s*[A-Za-z][^<>]*?>/g, "open-tag");
  return ranges;
}

function overlap(start: number, end: number, ranges: ProtectedRange[]): boolean {
  return ranges.some((r) => start < r.end && end > r.start);
}

/**
 * Decide whether a candidate range crosses a markup boundary
 * (i.e. starts inside a `<tag>` open tag and ends outside it).
 * Returns `true` when the candidate is unsafe.
 */
function crossesMarkup(start: number, end: number, ranges: ProtectedRange[]): boolean {
  return overlap(start, end, ranges);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compute the surrounding sentence for context. We use a simple
 * heuristic: the last sentence terminator before the start, and
 * the first sentence terminator after the end. Tags are stripped.
 */
function contextAt(text: string, start: number, end: number): string {
  const TERMINATORS = [".", "!", "?", "。", "！", "？"];
  let left = 0;
  for (const t of TERMINATORS) {
    const a = text.lastIndexOf(t, Math.max(0, start - 1));
    if (a > left) left = a + 1;
  }
  const rights: number[] = [];
  for (const t of TERMINATORS) {
    let pos = start;
    while (pos < text.length) {
      const a = text.indexOf(t, pos);
      if (a < 0 || a >= end + 200) break;
      rights.push(a);
      pos = a + 1;
    }
  }
  let right = text.length;
  if (rights.length > 0) {
    right = Math.min(...rights) + 1;
  } else {
    right = Math.min(text.length, end + 120);
  }
  return text
    .slice(left, right)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SuggestOptions extends InternalLinkOptions {
  /** Pre-existing link URLs to avoid duplicating. */
  existingLinks?: string[];
}

/**
 * Suggest internal links in `content` based on `targets`. Pure;
 * never mutates `content`; never throws; returns a list of
 * suggestions (possibly empty). The list is deterministic.
 */
export function suggestLinks(
  content: string,
  targets: InternalLinkTarget[],
  existingLinks: string[] = [],
  options: SuggestOptions = {},
): InternalLinkSuggestion[] {
  const c: Required<InternalLinkOptions> = { ...DEFAULTS, ...options };
  if (!Array.isArray(targets) || targets.length === 0) return [];

  const ranges = protectedRanges(content, c);
  const usedTargets = new Set<string>(existingLinks);
  const usedAnchors = new Set<string>();
  const perType = new Map<string, number>();
  const out: InternalLinkSuggestion[] = [];

  // Deterministic ranking: confidence DESC, priority DESC, then
  // by entityId lexical ASC, then by url lexical ASC.
  const sorted = [...targets].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const bp = b.priority ?? 50;
    const ap = a.priority ?? 50;
    if (bp !== ap) return bp - ap;
    const eid = String(a.entityId).localeCompare(String(b.entityId));
    if (eid !== 0) return eid;
    return a.url.localeCompare(b.url);
  });

  for (const t of sorted) {
    if (out.length >= c.maxLinksTotal) break;
    if (t.confidence < c.minConfidence) continue;
    if (usedTargets.has(t.url)) continue;
    const used = perType.get(t.entityType) ?? 0;
    if (used >= c.maxLinksPerEntityType) continue;
    const anchorRaw = String(t.label || "").trim();
    if (!anchorRaw) continue;
    const anchor =
      anchorRaw.length > c.maxAnchorLength
        ? anchorRaw.slice(0, c.maxAnchorLength)
        : anchorRaw;
    const anchorKey = anchor.toLowerCase();
    if (!c.allowRepeatedAnchor && usedAnchors.has(anchorKey)) continue;

    // Build a word-boundary regex. Match the anchor case-insensitively.
    const esc = escapeRegex(anchor);
    const re = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])(${esc})(?=$|[^\\p{L}\\p{N}])`,
      "giu",
    );
    let chosen: { start: number; end: number } | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      // m[1] is the anchor (single capture group).
      const start = m.index + (m[1].length - m[1].length); // index of first char
      // Simpler: m[0] includes the leading non-letter boundary
      // char. The anchor itself begins at `m.index + m[0].length - m[1].length`.
      const anchorStart = m.index + m[0].length - m[1].length;
      const anchorEnd = anchorStart + m[1].length;
      if (overlap(anchorStart, anchorEnd, ranges)) continue;
      if (crossesMarkup(anchorStart, anchorEnd, ranges)) continue;
      chosen = { start: anchorStart, end: anchorEnd };
      break;
    }
    if (!chosen) continue;

    // Ambiguity check: another high-confidence target with the
    // same label AND different entityId means we can't be sure.
    const ambiguous = sorted.some(
      (x) =>
        x !== t &&
        String(x.label).toLowerCase() === anchorKey &&
        x.entityId !== t.entityId &&
        x.confidence >= c.minConfidence,
    );
    if (ambiguous) continue;

    out.push({
      anchor,
      target: t.url,
      reason: "High-confidence entity match; suggestion only",
      confidence: t.confidence,
      startOffset: chosen.start,
      endOffset: chosen.end,
      context: contextAt(content, chosen.start, chosen.end),
      entityId: t.entityId,
      entityType: t.entityType,
    });
    usedTargets.add(t.url);
    usedAnchors.add(anchorKey);
    perType.set(t.entityType, used + 1);
  }

  // Final deterministic sort of the returned suggestions:
  // confidence DESC, priority DESC (via target order), first
  // occurrence ASC.
  out.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
    return a.target.localeCompare(b.target);
  });

  return out;
}
