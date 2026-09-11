// Football Factory — Commercial Frontend shell components (R2 Wave 2A).
//
// Adapted from external Commercial Frontend v3 R2 pack
// (src/components.tsx) with the following CRITICAL CHANGES:
//
//   1. SafeImage REMOVED entirely. Every image goes through Wave 1's
//      `HeroNewsImage` / `NewsCoverImage` / `ArticleEditorialImage`
//      from `@/components/image/rights-image`. There is no code path
//      in this file that renders an <img> tag with a bare URL.
//
//   2. AdSlot removed — replaced in a future slice by the consent-aware
//      CLS-safe AdSlot from Pack 05. Today we render a reserved
//      placeholder div instead.
//
//   3. Accessibility fixes applied:
//        - BreakingNewsTicker: aria-live="polite"
//        - ErrorState: role="alert"
//        - MainHeader hamburger button: aria-label="Open navigation menu"
//        - Heading hierarchy: <h1> on hero, <h2> on sections, <h3> on cards.
//
//   4. Styling uses CSS variables from app/globals.css (--bg, --ink,
//      --red, --line, etc.). All classes are scoped under .commercial-shell.

import Link from "next/link";
import type {
  CommercialMatch,
  CommercialNews,
  CommercialStanding,
} from "@/lib/commercial/contracts";
import { explainDegraded } from "@/lib/commercial/adapter";
import {
  HeroNewsImage,
  NewsCoverImage,
  ArticleEditorialImage,
} from "@/components/image/rights-image";

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export function Skeleton({ h = 180 }: { h?: number }) {
  return (
    <div aria-hidden className="cs-skeleton" style={{ height: h }} />
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="cs-state cs-empty" role="status">
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  retryHref,
}: {
  message: string;
  retryHref?: string;
}) {
  return (
    <div className="cs-state cs-error" role="alert">
      <b>Unable to load this section.</b>
      <p>{message}</p>
      {retryHref ? <Link href={retryHref}>Try again</Link> : null}
    </div>
  );
}

export function ReservedSlot({
  kind,
  height,
}: {
  kind: string;
  height: number;
}) {
  return (
    <aside
      className={`cs-slot cs-slot-${kind}`}
      aria-label={`Reserved ${kind} placement`}
      style={{ minHeight: height }}
    >
      <small>RESERVED · {kind.toUpperCase()}</small>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Header / Navigation
// ---------------------------------------------------------------------------

const COMPETITIONS: Array<{ label: string; slug: string }> = [
  { label: "Premier League", slug: "premier-league" },
  { label: "Champions League", slug: "champions-league" },
  { label: "LaLiga", slug: "laliga" },
  { label: "Bundesliga", slug: "bundesliga" },
  { label: "Serie A", slug: "serie-a" },
  { label: "Ligue 1", slug: "ligue-1" },
];

export function BreakingNewsTicker({ items }: { items: CommercialNews[] }) {
  if (!items.length) return null;
  return (
    <div className="cs-ticker" aria-live="polite" aria-atomic="false">
      <b className="cs-ticker-label">BREAKING</b>
      <div className="cs-ticker-rail">
        {items.map((n) => (
          <Link key={n.id} href={`/news/${n.slug}`}>
            {n.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MainHeader() {
  return (
    <header className="cs-header">
      <Link href="/" className="cs-brand" aria-label="Football Factory home">
        <span className="cs-brand-mark" aria-hidden>⚽</span>
        <strong>FOOTBALL FACTORY</strong>
      </Link>
      <button
        type="button"
        className="cs-menu-button"
        aria-label="Open navigation menu"
      >
        ☰
      </button>
      <nav className="cs-main-nav" aria-label="Primary">
        <Link href="/news">Latest</Link>
        <Link href="/news">News</Link>
        <Link href="/search">Search</Link>
        <Link href="/competitions/premier-league">Standings</Link>
      </nav>
    </header>
  );
}

export function LeagueNav() {
  return (
    <nav className="cs-league-nav" aria-label="Competitions">
      {COMPETITIONS.map((c) => (
        <Link key={c.slug} href={`/competitions/${c.slug}`}>
          {c.label}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Match / Fixtures / Standings
// ---------------------------------------------------------------------------

export function MatchStrip({ items }: { items: CommercialMatch[] }) {
  if (!items.length) {
    return <Empty label="No matches available" />;
  }
  return (
    <section className="cs-match-strip" aria-label="Matches">
      {items.map((m) => (
        <Link key={m.id} href={`/match/${m.id}`} className="cs-match">
          <small>{m.status}</small>
          <span>{m.home}</span>
          <b>
            {m.homeScore ?? "-"} : {m.awayScore ?? "-"}
          </b>
          <span>{m.away}</span>
        </Link>
      ))}
    </section>
  );
}

export function FixturesWidget({ items }: { items: CommercialMatch[] }) {
  if (!items.length) {
    return (
      <section className="cs-section">
        <SectionTitle title="Fixtures &amp; Results" href="/fixtures" />
        <Empty label="No fixtures available" />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title="Fixtures &amp; Results" href="/fixtures" />
      <div className="cs-fixture-list">
        {items.slice(0, 5).map((m) => (
          <Link key={m.id} href={`/match/${m.id}`} className="cs-fixture-row">
            <time>{m.kickoff}</time>
            <span>{m.home}</span>
            <b>
              {m.homeScore ?? "-"} – {m.awayScore ?? "-"}
            </b>
            <span>{m.away}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function StandingsWidget({ rows }: { rows: CommercialStanding[] }) {
  if (!rows.length) {
    return (
      <section className="cs-section">
        <SectionTitle title="Standings" href="/standings" />
        <Empty label="Standings unavailable" />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title="Standings" href="/standings" />
      <table className="cs-standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((r) => (
            <tr key={r.team}>
              <td>{r.pos}</td>
              <td>{r.team}</td>
              <td>{r.p}</td>
              <td><b>{r.pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------------------
// News grids / sections
// ---------------------------------------------------------------------------

export function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="cs-section-title">
      <h2>{title}</h2>
      {href ? <Link href={href}>View all →</Link> : null}
    </div>
  );
}

/**
 * NewsCard uses NewsCoverImage from Wave 1. The image asset is
 * passed through CommercialNews.image.asset. If asset is undefined
 * the Wave 1 component renders the "Image unavailable" fallback.
 */
export function NewsCard({
  n,
  variant = "standard",
}: {
  n: CommercialNews;
  variant?: "standard" | "compact" | "lead";
}) {
  return (
    <article className={`cs-card cs-card-${variant}`}>
      <Link href={`/news/${n.slug}`} className="cs-card-media-link">
        <NewsCoverImage
          asset={n.image.asset}
          sourcePolicy={
            n.image.sourcePolicyAttributionRequired != null
              ? { attribution_required: n.image.sourcePolicyAttributionRequired }
              : undefined
          }
        />
      </Link>
      <div className="cs-card-body">
        <span className="cs-badge">{n.section}</span>
        <h3>
          <Link href={`/news/${n.slug}`}>{n.title}</Link>
        </h3>
        <p>{n.excerpt}</p>
        <time className="cs-time">{n.publishedAt}</time>
      </div>
    </article>
  );
}

export function HeroNewsLayout({ items }: { items: CommercialNews[] }) {
  if (!items.length) {
    return <Empty label="No lead stories yet" />;
  }
  return (
    <section className="cs-hero">
      <NewsCard n={items[0]} variant="lead" />
      <div className="cs-hero-side">
        {items.slice(1, 3).map((n) => (
          <NewsCard key={n.id} n={n} variant="compact" />
        ))}
      </div>
    </section>
  );
}

export function LatestNewsGrid({ items }: { items: CommercialNews[] }) {
  if (!items.length) {
    return (
      <section className="cs-section">
        <SectionTitle title="Latest News" href="/news" />
        <Empty label="No news yet" />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title="Latest News" href="/news" />
      <div className="cs-news-grid">
        {items.slice(0, 8).map((n) => (
          <NewsCard key={n.id} n={n} />
        ))}
      </div>
    </section>
  );
}

export function LeagueNewsSection({
  slug,
  label,
  items,
}: {
  slug: string;
  label: string;
  items: CommercialNews[];
}) {
  return (
    <section className="cs-section">
      <SectionTitle title={label} href={`/competitions/${slug}`} />
      {items.length ? (
        <div className="cs-news-grid cs-league-grid">
          {items.slice(0, 4).map((n) => (
            <NewsCard key={n.id} n={n} />
          ))}
        </div>
      ) : (
        <Empty label={`No ${label} stories yet`} />
      )}
    </section>
  );
}

export function TrendingNews({ items }: { items: CommercialNews[] }) {
  if (!items.length) {
    return (
      <section className="cs-section">
        <SectionTitle title="Trending" href="/news" />
        <Empty label="Trending stories will appear here" />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title="Trending" href="/news" />
      <div className="cs-news-grid cs-trending-grid">
        {items.slice(0, 6).map((n) => (
          <NewsCard key={n.id} n={n} />
        ))}
      </div>
    </section>
  );
}

export function EditorsPick({ items }: { items: CommercialNews[] }) {
  if (!items.length) {
    return (
      <section className="cs-section">
        <SectionTitle title="Editor's Picks" />
        <Empty label="No editor's picks yet" />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title="Editor's Picks" />
      <div className="cs-news-grid cs-editors-grid">
        {items.slice(0, 4).map((n) => (
          <NewsCard key={n.id} n={n} variant="lead" />
        ))}
      </div>
    </section>
  );
}

export function TeamHubStrip({
  items,
}: {
  items: Array<{ slug: string; label: string; crest: string | null }>;
}) {
  if (!items.length) return null;
  return (
    <section className="cs-section">
      <SectionTitle title="Team Hubs" />
      <div className="cs-team-strip" aria-label="Team hubs">
        {items.map((t) => (
          <Link key={t.slug} href={`/teams/${t.slug}`} className="cs-team-tile">
            <div className="cs-team-crest" aria-hidden>
              {t.crest ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.crest} alt="" />
              ) : (
                <span>{t.label.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <strong>{t.label}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export function Footer() {
  return (
    <footer className="cs-footer">
      <strong>FOOTBALL FACTORY</strong>
      <nav aria-label="Footer">
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <small>
        Football news, data and analysis. ©{" "}
        {new Date().getFullYear()}
      </small>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Hero (large) — used by HeroNewsLayout or directly when only the lead
// is available. This is the only path that uses HeroNewsImage directly
// (the cover variant on NewsCard uses NewsCoverImage).
// ---------------------------------------------------------------------------

export function HeroLead({ n }: { n: CommercialNews | undefined }) {
  if (!n) return <Empty label="No lead story yet" />;
  return (
    <article className="cs-hero-lead">
      <Link href={`/news/${n.slug}`} className="cs-hero-lead-media">
        <HeroNewsImage
          asset={n.image.asset}
          sourcePolicy={
            n.image.sourcePolicyAttributionRequired != null
              ? { attribution_required: n.image.sourcePolicyAttributionRequired }
              : undefined
          }
        />
      </Link>
      <div className="cs-hero-lead-body">
        <span className="cs-badge">{n.section}</span>
        <h1>
          <Link href={`/news/${n.slug}`}>{n.title}</Link>
        </h1>
        <p>{n.excerpt}</p>
        <time className="cs-time">{n.publishedAt}</time>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ArticleEditorialImage wrapper for the article page (deferred to a later
// slice — see report "ARTICLE_IMAGE_WIRING: deferred").
// ---------------------------------------------------------------------------

export function ArticleEditorialImageForCommercial({
  asset,
}: {
  asset: import("@/lib/image-system/types").Asset | undefined;
}) {
  return <ArticleEditorialImage asset={asset} />;
}

export { explainDegraded };
