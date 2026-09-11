// Football Factory — Search page (R2 Wave 2A).
//
// Server-rendered search. The live ContentService does not expose
// a search method, so the adapter returns `available: false` for any
// non-empty query. The page renders a clear Empty state explaining
// this — it does NOT fabricate substring matches across latest
// news. NO direct DB or WP access.

import type { Metadata } from "next";
import Link from "next/link";
import {
  getCommercialSearchData,
  explainDegraded,
} from "@/lib/commercial/adapter";
import {
  MainHeader,
  LeagueNav,
  Footer,
  NewsCard,
  Empty,
  ErrorState,
  SectionTitle,
} from "@/components/commercial/shell";
import { SearchEventTracker } from "@/lib/analytics/trackers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/search" },
  title: "Search — Football Factory",
  description:
    "Search football news, transfers and analysis from Football Factory.",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

const MAX_QUERY_LEN = 80;

function safeParse(raw: string | undefined): string {
  if (!raw) return "";
  // Strip control characters, collapse whitespace, cap length.
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LEN);
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = safeParse(sp.q);
  const data = await getCommercialSearchData(query);

  const showUnavailableNotice =
    query.length > 0 && data.available === false;
  const message = showUnavailableNotice
    ? explainDegraded(data.source) ||
      "Search is not yet available. Please check back soon."
    : "";

  return (
    <main className="page commercial-shell" aria-label="Search">
      <MainHeader />
      <LeagueNav />
      <div className="cs-container">
        <SectionTitle title="Search" />
        <form
          method="get"
          action="/search"
          className="cs-search-form"
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 22,
          }}
        >
          <label htmlFor="q" className="visually-hidden" style={{ position: "absolute", left: -9999 }}>
            Search query
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search news, transfers, analysis"
            maxLength={MAX_QUERY_LEN}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid var(--cs-line)",
              borderRadius: 8,
              background: "var(--cs-surface)",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              background: "var(--cs-red)",
              color: "white",
              border: 0,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        {query.length === 0 ? (
          <Empty label="Enter a search query above." />
        ) : showUnavailableNotice ? (
          <ErrorState message={message} retryHref="/search" />
        ) : data.items.length === 0 ? (
          <Empty label="No results found." />
        ) : (
          <>
            <p className="cs-search-meta">
              {data.total} result{data.total === 1 ? "" : "s"} for{" "}
              <strong>“{query}”</strong>
            </p>
            <div className="cs-news-grid">
              {data.items.map((n) => (
                <NewsCard key={n.id} n={n} />
              ))}
            </div>
          </>
        )}

        <p style={{ marginTop: 18 }}>
          <Link href="/news">Browse latest news →</Link>
        </p>
      </div>
      <Footer />
      <SearchEventTracker query={query} />
    </main>
  );
}
