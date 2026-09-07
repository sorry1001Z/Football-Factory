import type { NewsItem } from './types';
import { mockNews } from './mock-data';

const endpoint = process.env.WORDPRESS_GRAPHQL_URL;

async function graphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!endpoint) throw new Error('WORDPRESS_GRAPHQL_URL is not configured');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  });

  if (!response.ok) throw new Error(`WordPress GraphQL request failed: ${response.status}`);
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors[0].message ?? 'GraphQL error');
  return json.data as T;
}

export async function getLatestNews(limit = 8): Promise<NewsItem[]> {
  if (!endpoint) return mockNews.slice(0, limit);

  try {
    const data = await graphQL<{
      posts: {
        nodes: Array<{
          slug: string;
          title: string;
          excerpt?: string;
          date?: string;
          categories?: { nodes: Array<{ name: string }> };
        }>;
      };
    }>(`query LatestPosts($first: Int!) {
      posts(first: $first, where: { status: PUBLISH }) {
        nodes {
          slug
          title
          excerpt
          date
          categories { nodes { name } }
        }
      }
    }`, { first: limit });

    return data.posts.nodes.map((post) => ({
      slug: post.slug,
      title: stripHtml(post.title),
      excerpt: stripHtml(post.excerpt ?? ''),
      category: post.categories?.nodes?.[0]?.name ?? 'ข่าวฟุตบอล',
      publishedAt: post.date ? new Date(post.date).toLocaleDateString('th-TH') : '',
    }));
  } catch {
    return mockNews.slice(0, limit);
  }
}

export async function getNewsBySlug(slug: string): Promise<NewsItem | null> {
  if (!endpoint) return mockNews.find((item) => item.slug === slug) ?? null;

  try {
    const data = await graphQL<{
      postBy: null | {
        slug: string;
        title: string;
        excerpt?: string;
        date?: string;
        categories?: { nodes: Array<{ name: string }> };
      };
    }>(`query PostBySlug($slug: String!) {
      postBy(slug: $slug) {
        slug
        title
        excerpt
        date
        categories { nodes { name } }
      }
    }`, { slug });

    if (!data.postBy) return null;
    return {
      slug: data.postBy.slug,
      title: stripHtml(data.postBy.title),
      excerpt: stripHtml(data.postBy.excerpt ?? ''),
      category: data.postBy.categories?.nodes?.[0]?.name ?? 'ข่าวฟุตบอล',
      publishedAt: data.postBy.date ? new Date(data.postBy.date).toLocaleDateString('th-TH') : '',
    };
  } catch {
    return mockNews.find((item) => item.slug === slug) ?? null;
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}
