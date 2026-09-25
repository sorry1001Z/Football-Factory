/** Build optional WordPress editorial fields from saved editorial metadata. */
export type EditorialWpFields = {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function trustedSourceUrl(value: unknown): string | undefined {
  const candidate = nonEmptyString(value);
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function buildEditorialWpFields(input: {
  metadata: Record<string, unknown>;
  fallbackTitle: string;
  fallbackContent: string;
  fallbackExcerpt?: string;
  fallbackSlug?: string;
}): EditorialWpFields {
  const title = nonEmptyString(input.metadata.title_th) ?? input.fallbackTitle;
  const content = nonEmptyString(input.metadata.body_th) ?? input.fallbackContent;
  const excerpt = nonEmptyString(input.metadata.excerpt_th) ?? nonEmptyString(input.fallbackExcerpt);
  const candidateSlug = nonEmptyString(input.metadata.slug) ?? nonEmptyString(input.fallbackSlug);
  const slug = candidateSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidateSlug)
    ? candidateSlug
    : undefined;

  const sourceUrl = trustedSourceUrl(input.metadata.source_url);
  const sourceTitle = nonEmptyString(input.metadata.source_title);
  const publisher = nonEmptyString(input.metadata.publisher);
  const sourceLabel = [sourceTitle, publisher].filter(Boolean).join(" — ");
  const attribution = sourceLabel
    ? sourceUrl
      ? `<p class="ff90-source-attribution">แหล่งข่าว: <a href="${escapeHtml(sourceUrl)}" rel="nofollow noopener noreferrer">${escapeHtml(sourceLabel)}</a></p>`
      : `<p class="ff90-source-attribution">แหล่งข่าว: ${escapeHtml(sourceLabel)}</p>`
    : "";

  return {
    title,
    content: attribution ? `${content}\n\n${attribution}` : content,
    ...(excerpt ? { excerpt } : {}),
    ...(slug ? { slug } : {}),
  };
}
