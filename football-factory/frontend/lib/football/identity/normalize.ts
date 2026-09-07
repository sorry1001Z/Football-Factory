// Football Factory — identity normalization.
// Single source of truth for "what does normalized identity look like".
// Phase 1.A: deterministic, non-aggressive. We do NOT:
//   - transliterate
//   - remove diacritics (Thai/Unicode preserved exactly)
//   - fuzzy match
// We DO:
//   - trim
//   - lowercase
//   - collapse repeated whitespace
//   - normalize a small set of punctuation variants
//   - preserve Unicode letters and digits as-is

const PUNCT_VARIANTS: Record<string, string> = {
  // straight apostrophes
  "'": "'", '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'",
  // straight quotes
  '"': '"', '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"',
  // dashes
  '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-',
  // ellipsis
  '\u2026': '...',
  // no-break / thin spaces
  '\u00A0': ' ', '\u2009': ' ', '\u200A': ' ', '\u200B': '', '\u200C': '', '\u200D': '',
  // fullwidth punctuation (used in CJK inputs)
  '\uFF0C': ',', '\uFF0E': '.', '\uFF1A': ':', '\uFF1B': ';', '\uFF1F': '?',
  '\uFF01': '!', '\uFF08': '(', '\uFF09': ')',
};

const PUNCT_CLASS = /[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2013\u2014\u2015\u2212\u2026\u00A0\u2009\u200A\u200B\u200C\u200D\uFF0C\uFF0E\uFF1A\uFF1B\uFF1F\uFF01\uFF08\uFF09]/g;

const WHITESPACE_CLASS = /\s+/g;

function normalizePunctuation(input: string): string {
  return input.replace(PUNCT_CLASS, (ch) => PUNCT_VARIANTS[ch] ?? ch);
}

/**
 * Produce a stable, case-insensitive key for identity matching.
 *
 * Returns "" for empty / whitespace-only input. NEVER throws.
 *
 * Important: this key is for matching only. canonical_ids are produced
 * separately via createXxxCanonicalId() to keep concerns split.
 */
export function normalizeIdentityKey(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  let s = String(input);
  s = normalizePunctuation(s);
  s = s.toLowerCase();
  s = s.trim();
  s = s.replace(WHITESPACE_CLASS, ' ');
  return s;
}

// ----- slug helpers -----

const KEBAB_RE = /[^a-z0-9]+/g;

/**
 * Produce a deterministic slug from a display name. Used by
 * createTeamCanonicalId() and createPlayerCanonicalId(). NOT used by
 * competition canonical_ids which are hand-curated in the registry.
 *
 * Note: this is Latin-script friendly. Non-Latin (Thai, CJK) names will
 * produce an empty slug — for those, callers must pass an explicit slug.
 */
export function toSlug(input: string): string {
  const norm = normalizeIdentityKey(input);
  return norm
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip combining marks only on Latin
    .replace(KEBAB_RE, '-')
    .replace(/^-+|-+$/g, '');
}

export function createCompetitionCanonicalId(slug: string): string {
  return `competition:${slug}`;
}

export function createLeagueCanonicalId(slug: string): string {
  return `league:${slug}`;
}

export function createCupCanonicalId(slug: string): string {
  return `cup:${slug}`;
}

export function createTeamCanonicalId(slug: string): string {
  return `team:${slug}`;
}

export function createPlayerCanonicalId(slug: string): string {
  return `player:${slug}`;
}
