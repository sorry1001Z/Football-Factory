import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNewsBySlug } from '@/lib/wordpress';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getNewsBySlug(slug);
  if (!post) return { title: 'ไม่พบบทความ' };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/news/${post.slug}` },
    openGraph: { title: post.title, description: post.excerpt, type: 'article' },
  };
}

export default async function NewsPage({ params }: Props) {
  const { slug } = await params;
  const post = await getNewsBySlug(slug);
  if (!post) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt,
    datePublished: new Date().toISOString(),
    publisher: { '@type': 'Organization', name: 'Football Factory' },
  };
  return (
    <main className="page"><article className="container articleShell">
      <div className="kicker">{post.category}</div><h1>{post.title}</h1><p className="lead">{post.excerpt}</p><small className="muted">{post.publishedAt}</small>
      <div className="articleBody"><p>เมื่อเชื่อม WordPress แล้ว เนื้อหาบทความจริงจะถูกดึงผ่าน WPGraphQL และแสดงในส่วนนี้ โดยหน้าเว็บยังคงถูก cache ผ่าน Vercel เพื่อความเร็วสูง</p><p>หน้านี้เตรียม canonical, Open Graph และ NewsArticle structured data ไว้แล้ว และสามารถต่อข้อมูล SEO จาก Yoast/Rank Math ได้ในขั้นถัดไป</p></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article></main>
  );
}
