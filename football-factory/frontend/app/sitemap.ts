import type { MetadataRoute } from 'next';
import { mockNews, mockMatches } from '@/lib/mock-data';
import { getSiteUrl } from '@/lib/seo/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const newsUrls = mockNews.map((p) => ({
    url: `${base}/news/${p.slug}`,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));
  const matchUrls = mockMatches.map((m) => ({
    url: `${base}/match/${m.slug}`,
    changeFrequency: 'hourly' as const,
    priority: 0.9,
  }));
  return [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    ...newsUrls,
    ...matchUrls,
  ];
}
