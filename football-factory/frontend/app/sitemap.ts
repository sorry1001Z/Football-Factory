import type { MetadataRoute } from 'next';
import { mockNews, mockMatches } from '@/lib/mock-data';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://football-factory.vercel.app';
  return [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    ...mockNews.map((p) => ({ url: `${base}/news/${p.slug}`, changeFrequency: 'daily' as const, priority: .8 })),
    ...mockMatches.map((m) => ({ url: `${base}/match/${m.slug}`, changeFrequency: 'hourly' as const, priority: .9 })),
  ];
}
