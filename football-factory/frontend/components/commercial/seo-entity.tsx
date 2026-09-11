// Football Factory — Entity Hub components (R2 Wave 2B).
//
// Server-rendered React components for /teams/[slug] and
// /competitions/[slug]. Reuses commercial-shell CSS variables and
// wave-1 image components. NEVER renders an image without a
// verified Asset (the Wave 1 component renders the no-use
// fallback when asset === undefined).
//
// Imports from @/lib/seo-entity/types and @/lib/seo-entity/service
// (NOT from raw provider APIs) so the hub layer stays decoupled
// from football-data / api-football specifics.

import Link from "next/link";
import type {
  ArticleRef,
  CompetitionHub,
  EntityRef,
  HubMatchRef,
  HubStandingRow,
  TeamHub,
} from "@/lib/seo-entity/types";
import {
  calculateThinPage,
  MIN_INDEXABLE_CONTENT_ITEMS,
} from "@/lib/seo-entity/service";
import { HeroNewsImage, NewsCoverImage } from "@/components/image/rights-image";
import {
  Empty,
  ErrorState,
  SectionTitle,
  ReservedSlot,
} from "@/components/commercial/shell";

// ---------------------------------------------------------------------------
// Entity Header (used by both team and competition pages)
// ---------------------------------------------------------------------------

export function EntityHeader({
  entity,
  eyebrow,
  country,
}: {
  entity: EntityRef;
  eyebrow: string;
  country?: string | null;
}) {
  return (
    <header className="cs-entity-head">
      <div className="cs-entity-crest" aria-hidden>
        {entity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entity.logoUrl} alt="" />
        ) : (
          <span>{entity.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div>
        <span className="cs-entity-eyebrow">{eyebrow}</span>
        <h1>{entity.name}</h1>
        {country ? <small className="cs-entity-country">{country}</small> : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// InternalLinks (entity cross-link)
// ---------------------------------------------------------------------------

export function EntityInternalLinks({
  teams = [],
  competition,
}: {
  teams?: EntityRef[];
  competition?: EntityRef | null;
}) {
  const hasContent =
    teams.length > 0 ||
    (competition && competition.canonicalId !== `competition:${competition.slug}`);
  if (!hasContent) return null;
  return (
    <nav className="cs-internal-links" aria-label="Related football entities">
      {competition ? (
        <Link href={`/competitions/${competition.slug}`}>{competition.name}</Link>
      ) : null}
      {teams.map((t) => (
        <Link key={t.canonicalId} href={`/teams/${t.slug}`}>
          {t.name}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Article Rail (latest news for an entity)
// ---------------------------------------------------------------------------

export function ArticleRail({
  title,
  items,
}: {
  title: string;
  items: ArticleRef[];
}) {
  if (!items.length) {
    return (
      <section className="cs-section">
        <SectionTitle title={title} />
        <Empty label={`No ${title.toLowerCase()} yet`} />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title={title} />
      <div className="cs-article-rail" aria-label={title}>
        {items.map((a) => (
          <Link key={a.slug} href={`/news/${a.slug}`} className="cs-article-rail-item">
            <strong>{a.title}</strong>
            <time>{a.publishedAt}</time>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fixtures / Standings mini-tables for hubs
// ---------------------------------------------------------------------------

export function HubFixturesTable({ items }: { items: HubMatchRef[] }) {
  if (!items.length) {
    return (
      <section className="cs-section">
        <SectionTitle title="Fixtures" />
        <Empty label="No fixtures available" />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title="Fixtures" />
      <div className="cs-fixture-list">
        {items.slice(0, 5).map((m) => (
          <div key={m.id} className="cs-fixture-row">
            <time>{m.kickoff}</time>
            <span>{m.homeTeamRef.name}</span>
            <b>
              {m.homeScore ?? "-"} – {m.awayScore ?? "-"}
            </b>
            <span>{m.awayTeamRef.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HubStandingsTable({ rows }: { rows: HubStandingRow[] }) {
  if (!rows.length) {
    return (
      <section className="cs-section">
        <SectionTitle title="Standings" />
        <Empty label="Standings unavailable" />
      </section>
    );
  }
  return (
    <section className="cs-section">
      <SectionTitle title="Standings" />
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
          {rows.slice(0, 10).map((r) => (
            <tr key={r.team.canonicalId}>
              <td>{r.pos}</td>
              <td>{r.team.name}</td>
              <td>{r.played}</td>
              <td><b>{r.points}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Thin-page notice (rendered when the page should not be indexed)
// ---------------------------------------------------------------------------

export function ThinPageNotice({ itemCount, threshold }: { itemCount: number; threshold: number }) {
  return (
    <div className="cs-thin-notice" role="status">
      This entity has only {itemCount} indexable items — below the{" "}
      {threshold}-item threshold. Search engines are asked not to index this
      page yet.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Hub page body
// ---------------------------------------------------------------------------

export function TeamHubBody({ hub }: { hub: TeamHub }) {
  // Item-count for thin-page check: latestNews + relatedArticles.
  const itemCount = hub.latestNews.length + hub.relatedArticles.length;
  const thin = calculateThinPage(
    [...hub.latestNews, ...hub.relatedArticles],
    MIN_INDEXABLE_CONTENT_ITEMS,
  );
  const unresolved = hub.source.identity === "unresolved";

  if (unresolved) {
    return (
      <ErrorState
        message={`No team registered for "${hub.team.slug}". Try a different slug or browse the team hubs list.`}
        retryHref="/"
      />
    );
  }

  return (
    <>
      <EntityHeader entity={hub.team} eyebrow="TEAM" country={hub.team.country} />
      {thin.isThin ? <ThinPageNotice itemCount={itemCount} threshold={thin.threshold} /> : null}

      <EntityInternalLinks competition={hub.competition} />

      <div className="cs-hub-grid">
        <ArticleRail title="Latest News" items={hub.latestNews} />
        <section className="cs-section">
          <SectionTitle title="Fixtures" />
          <HubFixturesTable items={hub.fixtures} />
        </section>
        <section className="cs-section">
          <SectionTitle title="League Position" />
          {hub.standing ? (
            <div className="cs-hub-stat">
              <span>{hub.standing.pos}</span>
              <small>
                Played: {hub.standing.played} · Pts: {hub.standing.points}
              </small>
            </div>
          ) : (
            <Empty label="Position unavailable" />
          )}
        </section>
        {hub.relatedPlayers.length ? (
          <section className="cs-section">
            <SectionTitle title="Related Players" />
            <EntityInternalLinks teams={hub.relatedPlayers} />
          </section>
        ) : null}
      </div>

      <ArticleRail title="Related Articles" items={hub.relatedArticles} />

      <ReservedSlot kind="leaderboard" height={90} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Competition Hub page body
// ---------------------------------------------------------------------------

export function CompetitionHubBody({ hub }: { hub: CompetitionHub }) {
  const itemCount = hub.latestNews.length + hub.relatedArticles.length;
  const thin = calculateThinPage(
    [...hub.latestNews, ...hub.relatedArticles],
    MIN_INDEXABLE_CONTENT_ITEMS,
  );
  const unresolved = hub.source.identity === "unresolved";

  if (unresolved) {
    return (
      <ErrorState
        message={`No competition registered for "${hub.competition.slug}". Try a different slug or browse the competitions list.`}
        retryHref="/"
      />
    );
  }

  return (
    <>
      <EntityHeader
        entity={hub.competition}
        eyebrow="COMPETITION"
        country={hub.competition.country}
      />
      {thin.isThin ? <ThinPageNotice itemCount={itemCount} threshold={thin.threshold} /> : null}

      <div className="cs-hub-grid">
        <ArticleRail title="Latest News" items={hub.latestNews} />
        <HubStandingsTable rows={hub.standings} />
        <HubFixturesTable items={hub.fixtures} />
        <section className="cs-section">
          <SectionTitle title="Teams" />
          <EntityInternalLinks teams={hub.teams} />
        </section>
      </div>

      <ArticleRail title="Related Content" items={hub.relatedArticles} />

      <ReservedSlot kind="leaderboard" height={90} />
    </>
  );
}

// Re-exports so consumers can pull hero / cover image components
// from a single import path if desired.
export { HeroNewsImage, NewsCoverImage };
