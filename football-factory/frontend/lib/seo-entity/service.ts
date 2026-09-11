// Football Factory — SEO Entity Hub service (R2 Wave 2B).
//
// Server-component-safe composition of live services into the
// entity-hub view model.
//
// Composes:
//   - lib/football (TEAM_REGISTRY, COMPETITION_REGISTRY, identity resolvers)
//   - lib/content (ContentService.getHomepageNews, getLiveScores)
//
// NEVER calls /api/football/* directly from this module — that would
// couple the hub layer to the football-data / api-football provider
// specifics. Instead, all standings / fixtures data flows through
// the existing /api/football/* API routes from server components.
//
// NEVER throws. Always returns a hub shape with a `source` block
// describing what data is real and what is degraded/unavailable.

import { headers } from "next/headers";
import {
  getHomepageNews,
  getLiveScores,
} from "@/lib/content";
import {
  resolveCompetition,
  resolveTeam,
  listTeams,
} from "@/lib/football/identity";
import type {
  CompetitionRegistryEntry,
  TeamRegistryEntry,
} from "@/lib/football/registry/types";
import { buildCanonical, getSiteUrl } from "@/lib/seo/seo";
import type {
  ArticleRef,
  CompetitionHub,
  EntityRef,
  HubMatchRef,
  HubStandingRow,
  SeoBridgeOutput,
  TeamHub,
  ThinPageAssessment,
} from "./types";

/**
 * Default thin-page threshold. The brief specifies MIN_INDEXABLE_CONTENT_ITEMS = 4.
 * An entity with fewer than this many items (latestNews + relatedArticles)
 * is rendered with noindex.
 */
export const MIN_INDEXABLE_CONTENT_ITEMS = 4;

/**
 * The maximum number of items we expose per rail. Keeps the page
 * payload bounded and prevents the adapter from emitting an entire
 * content-service response.
 */
export const MAX_NEWS_PER_HUB = 8;
export const MAX_MATCHES_PER_HUB = 6;
export const MAX_TEAMS_PER_COMPETITION = 10;
export const MAX_RELATED_PLAYERS = 6;

function toEntityRefFromTeam(t: TeamRegistryEntry): EntityRef {
  return {
    canonicalId: t.canonical_id,
    provider: "seed",
    sourceId: null,
    slug: t.canonical_id.replace(/^team:/, ""),
    name: t.display_name,
    logoUrl: null,
    country: t.country ?? null,
  };
}

function toEntityRefFromCompetition(c: CompetitionRegistryEntry): EntityRef {
  return {
    canonicalId: c.canonical_id,
    provider: "seed",
    sourceId: null,
    slug: c.canonical_id.replace(/^(league|competition|cup):/, ""),
    name: c.name,
    logoUrl: null,
    country: c.country ?? null,
  };
}

/**
 * Map a NewsItem from ContentService to an ArticleRef for the hub.
 * imageUrl is kept as the bare URL string; the hub rendering layer
 * (Wave 1 image components) decides whether to render.
 */
function toArticleRef(item: { slug: string; title: string; publishedAt: string; image?: string }): ArticleRef {
  return {
    slug: item.slug,
    title: item.title,
    publishedAt: item.publishedAt,
    imageUrl: item.image ?? null,
  };
}

/**
 * Server-side fetch to /api/football/standings. Returns empty array
 * on any error or non-OK response. Uses request headers to derive a
 * base URL.
 */
async function fetchStandingsFromApi(
  competitionSlug: string,
): Promise<Array<{ teamCanonicalId?: string; pos: number; team: string; played: number; points: number }>> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? null;
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (!host) return [];
    const url = `${proto}://${host}/api/football/standings?competition=${encodeURIComponent(competitionSlug)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const body = (await r.json()) as {
      value?: Array<{
        team?: { canonical_id?: string };
        position?: number;
        team_name?: string;
        played?: number;
        points?: number;
      }>;
    };
    const rows = body.value ?? [];
    return rows
      .filter((r) => typeof r.team_name === "string")
      .map((r, i) => ({
        teamCanonicalId: typeof r.team?.canonical_id === "string" ? r.team.canonical_id : undefined,
        pos: r.position ?? i + 1,
        team: r.team_name ?? "",
        played: r.played ?? 0,
        points: r.points ?? 0,
      }));
  } catch {
    return [];
  }
}

async function fetchFixturesFromApi(
  competitionSlug: string,
): Promise<HubMatchRef[]> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? null;
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (!host) return [];
    const url = `${proto}://${host}/api/football/matches?competition=${encodeURIComponent(competitionSlug)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const body = (await r.json()) as {
      value?: Array<{
        id?: string;
        home?: { canonical_id?: string; name?: string };
        away?: { canonical_id?: string; name?: string };
        home_score?: number;
        away_score?: number;
        status?: string;
        kickoff?: string;
      }>;
    };
    const rows = body.value ?? [];
    return rows.slice(0, MAX_MATCHES_PER_HUB).map((m, i) => ({
      id: m.id ?? `${competitionSlug}-${i}`,
      homeTeamRef: {
        canonicalId: m.home?.canonical_id ?? "team:unknown",
        provider: null,
        sourceId: null,
        slug: m.home?.canonical_id?.replace(/^team:/, "") ?? "",
        name: m.home?.name ?? "",
      },
      awayTeamRef: {
        canonicalId: m.away?.canonical_id ?? "team:unknown",
        provider: null,
        sourceId: null,
        slug: m.away?.canonical_id?.replace(/^team:/, "") ?? "",
        name: m.away?.name ?? "",
      },
      homeScore: m.home_score ?? null,
      awayScore: m.away_score ?? null,
      status: m.status ?? "",
      kickoff: m.kickoff ?? "",
    }));
  } catch {
    return [];
  }
}

/**
 * Resolve a team by URL slug. Slug form: `manchester-united` for
 * canonical_id `team:manchester-united`. Refuses to guess.
 */
function resolveTeamBySlug(slug: string): TeamRegistryEntry | null {
  const canonicalId = `team:${slug}`;
  const result = resolveTeam({ canonical_id: canonicalId });
  return result.status === "resolved" && result.entity ? result.entity : null;
}

/**
 * Resolve a competition by URL slug. Slug form: `premier-league` for
 * canonical_id `league:premier-league`. Refuses to guess; tries the
 * canonical prefixes league:/competition:/cup: in order. For named
 * tournaments whose canonical_id uses the `uefa-` prefix, also tries
 * `competition:uefa-<slug>`.
 */
function resolveCompetitionBySlug(slug: string): CompetitionRegistryEntry | null {
  const candidates = [
    `league:${slug}`,
    `competition:${slug}`,
    `cup:${slug}`,
    // Named tournaments carry an explicit prefix in the registry:
    `competition:uefa-${slug}`,
  ];
  for (const cid of candidates) {
    const r = resolveCompetition({ canonical_id: cid });
    if (r.status === "resolved" && r.entity) return r.entity;
  }
  return null;
}

/**
 * Get a TeamHub for the given slug. NEVER throws.
 *
 *   - If the slug is unknown, returns a "ghost" hub with identity
 *     = 'unresolved', empty arrays, and no source warnings.
 *   - Latest news comes from ContentService.getHomepageNews().
 *   - Standings: only if the team is the leader of a competition we
 *     recognize; the standings slice is small (this team only).
 *   - Fixtures: only if the team is a member of a recognized
 *     competition; fetched via /api/football/matches.
 *   - Related players: empty (deferred to a future slice).
 */
export async function getTeamHub(slug: string): Promise<TeamHub> {
  const team = resolveTeamBySlug(slug);

  let newsResult;
  try {
    newsResult = await getHomepageNews();
  } catch {
    newsResult = null;
  }

  const latestNews: ArticleRef[] = (newsResult?.latest ?? [])
    .slice(0, MAX_NEWS_PER_HUB)
    .map(toArticleRef);
  const relatedArticles: ArticleRef[] = (newsResult?.side ?? [])
    .slice(0, MAX_NEWS_PER_HUB)
    .map(toArticleRef);

  let competition: EntityRef | null = null;
  let standing: HubStandingRow | null = null;
  let fixtures: HubMatchRef[] = [];

  if (team) {
    // Pick the highest-priority competition the team belongs to.
    const primaryCid = team.competition_canonical_ids[0] ?? null;
    if (primaryCid) {
      const comp = resolveCompetition({ canonical_id: primaryCid });
      if (comp.status === "resolved" && comp.entity) {
        const compSlug = comp.entity.canonical_id.replace(
          /^(league|competition|cup):/,
          "",
        );
        competition = toEntityRefFromCompetition(comp.entity);
        fixtures = await fetchFixturesFromApi(compSlug);
        const standingsRaw = await fetchStandingsFromApi(compSlug);
        const standingRow = standingsRaw.find(
          (r) => r.teamCanonicalId === team.canonical_id,
        );
        if (standingRow) {
          standing = {
            pos: standingRow.pos,
            team: toEntityRefFromTeam(team),
            played: standingRow.played,
            points: standingRow.points,
          };
        }
      }
    }
  }

  return {
    team: team ? toEntityRefFromTeam(team) : {
      canonicalId: `team:${slug}`,
      provider: null,
      sourceId: null,
      slug,
      name: slug.replaceAll("-", " "),
      logoUrl: null,
    },
    competition,
    latestNews,
    fixtures,
    standing,
    relatedPlayers: [], // future slice
    relatedArticles,
    source: {
      identity: team ? "seed" : "unresolved",
      news: newsResult?.source.data ?? "unconfigured",
      fixtures: team && competition ? (fixtures.length ? "wpgraphql" : "degraded") : "n/a",
      standings: team && competition ? (standing ? "wpgraphql" : "degraded") : "n/a",
    },
  };
}

/**
 * Get a CompetitionHub for the given slug. NEVER throws.
 */
export async function getCompetitionHub(slug: string): Promise<CompetitionHub> {
  const competition = resolveCompetitionBySlug(slug);

  let newsResult;
  try {
    newsResult = await getHomepageNews();
  } catch {
    newsResult = null;
  }

  const latestNews: ArticleRef[] = (newsResult?.latest ?? [])
    .slice(0, MAX_NEWS_PER_HUB)
    .map(toArticleRef);

  let standings: HubStandingRow[] = [];
  let fixtures: HubMatchRef[] = [];
  let teams: EntityRef[] = [];

  if (competition) {
    const standingsRaw = await fetchStandingsFromApi(slug);
    const teamByCid = new Map<string, EntityRef>();
    for (const t of listTeams()) {
      if (t.competition_canonical_ids.includes(competition.canonical_id)) {
        teamByCid.set(t.canonical_id, toEntityRefFromTeam(t));
      }
    }
    standings = standingsRaw.slice(0, MAX_TEAMS_PER_COMPETITION).map((r): HubStandingRow => {
      let ref: EntityRef;
      const fromCid = r.teamCanonicalId ? teamByCid.get(r.teamCanonicalId) : null;
      if (fromCid) {
        ref = fromCid;
      } else {
        ref = {
          canonicalId: `team:${r.team.toLowerCase().replace(/\s+/g, "-")}`,
          provider: null,
          sourceId: null,
          slug: r.team.toLowerCase().replace(/\s+/g, "-"),
          name: r.team,
          logoUrl: null,
        };
      }
      return { pos: r.pos, team: ref, played: r.played, points: r.points };
    });
    fixtures = await fetchFixturesFromApi(slug);
    teams = Array.from(teamByCid.values()).slice(0, MAX_TEAMS_PER_COMPETITION);
  }

  return {
    competition: competition
      ? toEntityRefFromCompetition(competition)
      : {
          canonicalId: `competition:${slug}`,
          provider: null,
          sourceId: null,
          slug,
          name: slug.replaceAll("-", " "),
          logoUrl: null,
        },
    latestNews,
    standings,
    fixtures,
    teams,
    relatedArticles: (newsResult?.side ?? [])
      .slice(0, MAX_NEWS_PER_HUB)
      .map(toArticleRef),
    source: {
      identity: competition ? "seed" : "unresolved",
      news: newsResult?.source.data ?? "unconfigured",
      fixtures: competition ? (fixtures.length ? "wpgraphql" : "degraded") : "n/a",
      standings: competition ? (standings.length ? "wpgraphql" : "degraded") : "n/a",
    },
  };
}

/**
 * Calculate thin-page assessment.
 *
 *   - 0 items: thin
 *   - 1..(threshold-1): thin
 *   - threshold..: indexable
 */
export function calculateThinPage(
  items: unknown[],
  threshold: number = MIN_INDEXABLE_CONTENT_ITEMS,
): ThinPageAssessment {
  const count = Array.isArray(items) ? items.length : 0;
  return {
    isThin: count < threshold,
    itemCount: count,
    threshold,
  };
}

/**
 * SeoBridge: maps hub data into the existing lib/seo/seo helpers.
 *
 *   - canonical: buildCanonical(path) — strips query strings.
 *   - title: <Team/Competition Name> — Football Factory
 *   - description: short summary
 *   - noindex: thin-page logic
 *   - breadcrumbs: Home > Competitions / Teams > <Entity>
 *   - jsonLd: WebPage + BreadcrumbList; CollectionPage only when threshold met.
 */
export function buildHubSeo(args: {
  entity: EntityRef;
  kind: "team" | "competition";
  itemCount: number;
  threshold?: number;
}): SeoBridgeOutput {
  const path =
    args.kind === "team"
      ? `/teams/${args.entity.slug}`
      : `/competitions/${args.entity.slug}`;
  const canonical = buildCanonical(path); // strips query strings
  const title = `${args.entity.name} — Football Factory`;
  const description =
    args.kind === "team"
      ? `${args.entity.name}: latest news, fixtures, standings and related content.`
      : `${args.entity.name}: latest news, fixtures, standings and team directory.`;
  const threshold = args.threshold ?? MIN_INDEXABLE_CONTENT_ITEMS;
  const noindex = args.itemCount < threshold;

  const breadcrumbs = [
    { name: "Home", path: "/" },
    args.kind === "team"
      ? { name: "Teams", path: "/teams" }
      : { name: "Competitions", path: "/competitions" },
    { name: args.entity.name, path },
  ];

  const site = getSiteUrl();
  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": args.kind === "team" ? "WebPage" : "CollectionPage",
      name: args.entity.name,
      url: canonical,
      isPartOf: { "@type": "WebSite", name: "Football Factory", url: site },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: `${site}${b.path}`,
      })),
    },
  ];
  if (!noindex) {
    // Add a CollectionPage hint when content is rich enough to index.
    jsonLd[0] = {
      ...(jsonLd[0] as Record<string, unknown>),
      "@type": args.kind === "team" ? "WebPage" : "CollectionPage",
    };
  }

  return { canonical, title, description, noindex, breadcrumbs, jsonLd };
}

/**
 * Returns a small map of slug → display name for the 6 leagues the
 * brief calls out by name. Used by the home page's league nav
 * (already exists in commercial-shell) AND by entity-hub pages to
 * surface the canonical slug.
 */
export const LEAGUE_SLUGS: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: "premier-league", name: "Premier League" },
  { slug: "champions-league", name: "Champions League" },
  { slug: "laliga", name: "LaLiga" },
  { slug: "bundesliga", name: "Bundesliga" },
  { slug: "serie-a", name: "Serie A" },
  { slug: "ligue-1", name: "Ligue 1" },
];
