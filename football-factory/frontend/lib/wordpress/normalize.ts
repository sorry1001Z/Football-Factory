// Football Factory — WordPress response normalizers (Phase 2)
// Pure functions. Take the raw WPGraphQL response fragment and return
// canonical types from ./types. Never throw, never expose raw values,
// never include credentials.

import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPost,
  WordPressSeo,
  WordPressTag,
} from "./types";

/** Strip HTML tags and decode common entities. Best-effort, not bulletproof. */
export function stripHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(v: unknown, key: string): string {
  if (!isPlainObject(v)) return "";
  const raw = v[key];
  return typeof raw === "string" ? raw : "";
}

function pickNumber(v: unknown, key: string): number | null {
  if (!isPlainObject(v)) return null;
  const raw = v[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickArray(v: unknown, key: string): unknown[] {
  if (!isPlainObject(v)) return [];
  const raw = v[key];
  return Array.isArray(raw) ? raw : [];
}

function pickNested(v: unknown, key: string): Record<string, unknown> | null {
  if (!isPlainObject(v)) return null;
  const raw = v[key];
  if (isPlainObject(raw) && "node" in raw) {
    const node = (raw as { node: unknown }).node;
    if (isPlainObject(node)) return node;
    return null;
  }
  if (isPlainObject(raw)) return raw;
  return null;
}

// ----- media ----------------------------------------------------------------

export function normalizeWordPressMedia(raw: unknown): WordPressMedia | null {
  if (!isPlainObject(raw)) return null;
  const url = pickString(raw, "sourceUrl");
  if (!url) return null;
  const details = pickNested(raw, "mediaDetails") ?? pickNested(raw, "media_details");
  return {
    id: pickString(raw, "id") || null,
    url,
    alt: pickString(raw, "altText"),
    width: details ? pickNumber(details, "width") : null,
    height: details ? pickNumber(details, "height") : null,
    mimeType: pickString(raw, "mimeType"),
  };
}

// ----- author ---------------------------------------------------------------

export function normalizeWordPressAuthor(raw: unknown): WordPressAuthor | null {
  if (!isPlainObject(raw)) return null;
  const name = pickString(raw, "name");
  if (!name) return null;
  const avatar = pickNested(raw, "avatar");
  return {
    id: pickString(raw, "id") || null,
    slug: pickString(raw, "slug"),
    name,
    description: pickString(raw, "description"),
    avatarUrl: avatar ? pickString(avatar, "url") || null : null,
  };
}

// ----- taxonomy -------------------------------------------------------------

export function normalizeWordPressCategory(raw: unknown): WordPressCategory | null {
  if (!isPlainObject(raw)) return null;
  const name = pickString(raw, "name");
  if (!name) return null;
  return {
    id: pickString(raw, "id") || null,
    slug: pickString(raw, "slug"),
    name,
    description: pickString(raw, "description"),
  };
}

export function normalizeWordPressTag(raw: unknown): WordPressTag | null {
  if (!isPlainObject(raw)) return null;
  const name = pickString(raw, "name");
  if (!name) return null;
  return {
    id: pickString(raw, "id") || null,
    slug: pickString(raw, "slug"),
    name,
    description: pickString(raw, "description"),
  };
}

function normalizeTaxonomy<T>(rawList: unknown, normalizer: (v: unknown) => T | null): T[] {
  if (!isPlainObject(rawList)) return [];
  const nodes = pickArray(rawList, "nodes");
  const out: T[] = [];
  for (const node of nodes) {
    const v = normalizer(node);
    if (v) out.push(v);
  }
  return out;
}

// ----- SEO ------------------------------------------------------------------

export function normalizeWordPressSeo(raw: unknown): WordPressSeo | null {
  if (!isPlainObject(raw)) return null;
  const ogImage = pickNested(raw, "opengraphImage");
  const twImage = pickNested(raw, "twitterImage");
  const schema = pickNested(raw, "schema");
  return {
    title: pickString(raw, "title") || null,
    description: pickString(raw, "metaDesc") || null,
    canonical: pickString(raw, "canonical") || null,
    robots: pickString(raw, "metaRobotsNoindex") || null,
    openGraphTitle: pickString(raw, "opengraphTitle") || null,
    openGraphDescription: pickString(raw, "opengraphDescription") || null,
    openGraphImage: ogImage ? pickString(ogImage, "sourceUrl") || null : null,
    twitterTitle: pickString(raw, "twitterTitle") || null,
    twitterDescription: pickString(raw, "twitterDescription") || null,
    twitterImage: twImage ? pickString(twImage, "sourceUrl") || null : null,
    schemaRaw: schema ? pickString(schema, "raw") || null : null,
  };
}

// ----- post -----------------------------------------------------------------

export function normalizeWordPressPost(raw: unknown): WordPressPost | null {
  if (!isPlainObject(raw)) return null;
  const id = pickString(raw, "id");
  const slug = pickString(raw, "slug");
  if (!id && !slug) return null;
  const uri = pickString(raw, "uri");
  const titleRaw = pickString(raw, "title");
  const excerptRaw = pickString(raw, "excerpt");
  const contentRaw = pickString(raw, "content");
  return {
    id: id || `slug:${slug}`,
    databaseId: pickNumber(raw, "databaseId"),
    slug,
    uri,
    title: stripHtml(titleRaw),
    excerpt: stripHtml(excerptRaw),
    content: contentRaw,
    date: pickString(raw, "date") || null,
    modified: pickString(raw, "modified") || null,
    status: pickString(raw, "status"),
    featuredImage: normalizeWordPressMedia(pickNested(raw, "featuredImage")),
    author: normalizeWordPressAuthor(pickNested(raw, "author")),
    categories: normalizeTaxonomy(pickNested(raw, "categories"), normalizeWordPressCategory),
    tags: normalizeTaxonomy(pickNested(raw, "tags"), normalizeWordPressTag),
    seo: normalizeWordPressSeo(pickNested(raw, "seo")),
    canonical: null, // populated by service layer (uri + canonical)
  };
}
