// Football Factory — SEO bridge (Phase 2)
// Maps WordPress SEO + canonical post into Next.js Metadata. Pure
// helpers; no side effects. Canonical hostname is taken from the public
// env var so the same code works in local dev, preview, and production.

import type { Metadata } from "next";
import type { WordPressPost, WordPressSeo } from "@/lib/wordpress/types";

export function getSiteUrl(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  // Phase 2 placeholder. Never hard-code a domain in production — the
  // public env var is the source of truth.
  return "https://football-factory-three.vercel.app";
}

export function buildCanonical(path: string): string {
  const base = getSiteUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

interface SeoFromPostInput {
  post: WordPressPost;
  path: string;
  /** Optional override used by phase 2 plugins later (Yoast/Rank Math raw). */
  fallbackTitle?: string | null;
  fallbackDescription?: string | null;
  fallbackImage?: string | null;
}

export function buildPostMetadata(input: SeoFromPostInput): Metadata {
  const { post, path, fallbackTitle, fallbackDescription, fallbackImage } = input;
  const seo: WordPressSeo | null = post.seo;
  const title = seo?.title?.trim() || post.title?.trim() || fallbackTitle || "Football Factory";
  const description =
    seo?.description?.trim() ||
    post.excerpt?.trim() ||
    fallbackDescription ||
    "";
  const canonical = seo?.canonical?.trim() || buildCanonical(path);
  const ogTitle = seo?.openGraphTitle?.trim() || title;
  const ogDescription = seo?.openGraphDescription?.trim() || description;
  const ogImage = seo?.openGraphImage || fallbackImage || post.featuredImage?.url || null;
  const twitterTitle = seo?.twitterTitle?.trim() || ogTitle;
  const twitterDescription = seo?.twitterDescription?.trim() || ogDescription;
  const twitterImage = seo?.twitterImage || ogImage;

  return {
    title,
    description: description || undefined,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription || undefined,
      url: canonical,
      type: "article",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: twitterImage ? "summary_large_image" : "summary",
      title: twitterTitle,
      description: twitterDescription || undefined,
      images: twitterImage ? [twitterImage] : undefined,
    },
    robots: seo?.robots || undefined,
  };
}

export function buildNewsArticleJsonLd(post: WordPressPost, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date || new Date().toISOString(),
    dateModified: post.modified || post.date || new Date().toISOString(),
    mainEntityOfPage: buildCanonical(path),
    author: post.author ? {
      "@type": "Person",
      name: post.author.name,
      url: post.author.slug ? buildCanonical(`/author/${post.author.slug}`) : undefined,
    } : { "@type": "Organization", name: "Football Factory" },
    publisher: {
      "@type": "Organization",
      name: "Football Factory",
      logo: { "@type": "ImageObject", url: `${getSiteUrl()}/logo.png` },
    },
    image: post.featuredImage?.url ? [post.featuredImage.url] : undefined,
    articleSection: post.categories[0]?.name,
    keywords: post.tags.map((t: { name: string }) => t.name).join(",") || undefined,
  };
}
