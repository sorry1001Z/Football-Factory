// Football Factory — News list page (R2 Wave 2A).
//
// Server-rendered list of latest news. Uses the commercial
// adapter (which composes ContentService). Pagination is via
// `?page=N`. NO direct DB or WP access.

import type { Metadata } from "next";
import Link from "next/link";
import {
  getCommercialNewsListData,
  explainDegraded,
} from "@/lib/commercial/adapter";
import {
  MainHeader,
  LeagueNav,
  Footer,
  NewsCard,
  SectionTitle,
  Empty,
  ErrorState,
  ReservedSlot,
} from "@/components/commercial/shell";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/news" },
  title: "News — Football Factory",
  description:
    "Latest football news, transfers, analysis and fixtures from every major league.",
};

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function NewsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const pageRaw = Number(sp.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize = 10;

  const data = await getCommercialNewsListData(page, pageSize);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const degraded =
    data.source.data === "degraded" && data.items.length === 0;
  const degradedMessage = explainDegraded(data.source);

  return (
    <main className="page commercial-shell" aria-label="Latest news">
      <MainHeader />
      <LeagueNav />
      <div className="cs-container">
        <SectionTitle title="Latest News" />
        {degraded ? (
          <ErrorState message={degradedMessage || "News is unavailable."} retryHref="/news" />
        ) : data.items.length === 0 ? (
          <Empty label="No news yet" />
        ) : (
          <>
            <div className="cs-news-grid">
              {data.items.map((n) => (
                <NewsCard key={n.id} n={n} />
              ))}
            </div>
            <nav
              className="cs-pagination"
              aria-label="Pagination"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "flex-end",
                margin: "22px 0 28px",
              }}
            >
              {page > 1 ? (
                <Link href={`/news?page=${page - 1}`}>← Previous</Link>
              ) : (
                <span aria-disabled="true" style={{ opacity: 0.4 }}>← Previous</span>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={`/news?page=${page + 1}`}>Next →</Link>
              ) : (
                <span aria-disabled="true" style={{ opacity: 0.4 }}>Next →</span>
              )}
            </nav>
          </>
        )}
        <ReservedSlot kind="leaderboard" height={90} />
      </div>
      <Footer />
    </main>
  );
}
