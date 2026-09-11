import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArticleBySlug } from '@/lib/content';
import { buildPostMetadata, buildNewsArticleJsonLd, buildCanonical } from '@/lib/seo/seo';
import { mockNews } from '@/lib/mock-data';
import { ArticleInlineAd } from "@/components/ads/ad-slot";
import { AD_PRESETS } from "@/components/ads/presets";
import { ArticleViewTracker } from '@/lib/analytics/trackers';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

const mockItem = (slug: string) => mockNews.find((m) => m.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { post, newsItem } = await getArticleBySlug(slug);
  const path = `/news/${slug}`;
  if (post) {
    return buildPostMetadata({
      post,
      path,
      fallbackTitle: newsItem?.title,
      fallbackDescription: newsItem?.excerpt,
      fallbackImage: newsItem?.image,
    });
  }
  if (newsItem) {
    return {
      title: newsItem.title,
      description: newsItem.excerpt,
      alternates: { canonical: buildCanonical(path) },
      openGraph: {
        title: newsItem.title,
        description: newsItem.excerpt,
        type: 'article',
        url: buildCanonical(path),
        images: newsItem.image ? [newsItem.image] : undefined,
      },
    };
  }
  return { title: 'ไม่พบบทความ' };
}

export default async function NewsPage({ params }: Props) {
  const { slug } = await params;
  const { post, newsItem } = await getArticleBySlug(slug);
  if (!post && !newsItem) notFound();

  const title = post?.title ?? newsItem!.title;
  const excerpt = post?.excerpt ?? newsItem!.excerpt;
  const publishedAt = post?.date ? new Date(post.date).toLocaleDateString('th-TH') : (newsItem?.publishedAt ?? '');
  const category =
    post && post.categories.length > 0 ? post.categories[0].name :
    newsItem?.category ?? 'ข่าวฟุตบอล';
  const author = post?.author?.name ?? 'Football Factory Newsroom';
  const featuredImage = post?.featuredImage?.url ?? newsItem?.image;

  // For mock fallback, surface a useful body. For real WordPress posts,
  // render the canonical content. (Phase 2 deliberately keeps the existing
  // body structure rather than blindly trusting raw HTML.)
  const bodyParagraphs = post
    ? (post.content ? post.content.split(/\n\n+/).slice(0, 8) : [post.excerpt || 'เนื้อหากำลังเตรียม'])
    : [
        'เมื่อเชื่อม WordPress แล้ว เนื้อหาบทความจริงจะถูกดึงผ่าน WPGraphQL และแสดงในส่วนนี้ โดยหน้าเว็บยังคงถูก cache ผ่าน Vercel เพื่อความเร็วสูง',
        'หน้านี้เตรียม canonical, Open Graph และ NewsArticle structured data ไว้แล้ว และสามารถต่อข้อมูล SEO จาก Yoast/Rank Math ได้ในขั้นถัดไป',
      ];

  const jsonLd = post
    ? buildNewsArticleJsonLd(post, `/news/${slug}`)
    : {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: title,
        description: excerpt,
        datePublished: new Date().toISOString(),
        publisher: { '@type': 'Organization', name: 'Football Factory' },
      };

  const related = mockNews
    .filter((m) => m.slug !== slug)
    .slice(0, 4);

  return (
    <main className="page">
      <article className="container articleShell">
        <div className="kicker">{category}</div>
        <h1>{title}</h1>
        <p className="lead">{excerpt}</p>
        <small className="muted">โดย {author} · {publishedAt}</small>
        {featuredImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="articleHero" src={featuredImage} alt={title} loading="lazy" />
        ) : null}
        <div className="articleBody">
          {bodyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {related.length > 0 ? (
          <section className="relatedSection">
            <h2>ข่าวที่เกี่ยวข้อง</h2>
            <ul>
              {related.map((m) => (
                <li key={m.slug}>
                  <a href={`/news/${m.slug}`}>{m.title}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <ArticleInlineAd config={AD_PRESETS["article-inline"]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </article>
      <ArticleViewTracker id={slug} />
    </main>
  );
}
