export type SourceAttribution = { label: string; href: string | null };

export function extractWpSourceAttribution(content: string): {
  body: string;
  attribution: SourceAttribution | null;
} {
  const linked = /<p class="ff90-source-attribution">แหล่งข่าว: <a href="(https:\/\/[^"<>]+)" rel="nofollow noopener noreferrer">((?:&(?:amp|lt|gt|quot|#39);|[^<])*)<\/a><\/p>/i;
  const textOnly = /<p class="ff90-source-attribution">แหล่งข่าว: ((?:&(?:amp|lt|gt|quot|#39);|[^<])*)<\/p>/i;
  const match = linked.exec(content);
  if (match) {
    const href = decodeAttribute(match[1]);
    try {
      if (new URL(href).protocol === "https:") {
        return {
          body: content.replace(match[0], "").trim(),
          attribution: { href, label: decodeAttribute(match[2]) },
        };
      }
    } catch {
      // Invalid URLs are left in body text and never made clickable.
    }
  }
  const plain = textOnly.exec(content);
  if (!plain) return { body: content, attribution: null };
  return {
    body: content.replace(plain[0], "").trim(),
    attribution: { href: null, label: decodeAttribute(plain[1]) },
  };
}

function decodeAttribute(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (_entity, name: string) => ({
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    "#39": "'",
  })[name]!);
}
