import Link from 'next/link';
import type { NewsItem } from '@/lib/types';

export function NewsCard({ item, index = 0 }: { item: NewsItem; index?: number }) {
  return (
    <article className="newsCard">
      <div className={`newsVisual visual${(index % 4) + 1}`} aria-hidden="true">
        <span>FF</span>
      </div>
      <div className="newsBody">
        <div className="eyebrow">{item.category}</div>
        <h3><Link href={`/news/${item.slug}`}>{item.title}</Link></h3>
        <p>{item.excerpt}</p>
        <small>{item.publishedAt}</small>
      </div>
    </article>
  );
}
