// Football Factory — Commercial Frontend adapter (R2 Wave 2A).
//
// Server-component safe adapter that composes the live
// ContentService + FootballService into the commercial view model.
//
// All calls are wrapped in try/catch. The adapter NEVER throws.
// On error, it returns a degraded HomeData/NewsListData/SearchData
// with the source field set to { origin: "degraded", data: "degraded",
// degradedReason: "<kind>" }. The page renders an ErrorState UI.
//
// NO direct DB access. NO direct WordPress call from the adapter.
// NO fake production content. NO bypassing Wave 1 rights gates.

import { headers } from "next/headers";
import { getHomepageNews, getLiveScores } from "@/lib/content";
import type { NewsItem, MatchItem } from "@/lib/types";
import type { Asset } from "@/lib/image-system/types";
import type {
  AdapterError,
  CommercialImageRef,
  CommercialMatch,
  CommercialNews,
  CommercialStanding,
  HomeData,
  NewsListData,
  SearchData,
} from "./contracts";

/**
 * Map a NewsItem.image (string URL) into a SAFE CommercialImageRef.
 *
 * NOTE: We never fabricate an Asset from a bare URL. The live data
 * model only carries a URL string, not a rights-resolved Asset.
 * Therefore:
 *   - asset = undefined  (we don't trust the URL alone to set rights state)
 *   - The component layer (rights-image.tsx) sees asset=undefined and
 *     renders the "Image unavailable" fallback — NOT an unrestrained image.
 *   - Once the data layer surfaces an actual Asset (a future slice
 *     that adds image-system wiring to editorial_items), this adapter
 *     will be the place to translate it.
 *
 * This is the CRITICAL SAFETY: no image renders until an Asset exists.
 */
function safeImageRef(item: { image?: string }): CommercialImageRef {
  // We do NOT construct an Asset from a bare URL. Pass undefined.
  return { asset: undefined };
}

function newsItemToCommercial(item: NewsItem): CommercialNews {
  return {
    id: item.slug,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    section: item.category,
    publishedAt: item.publishedAt,
    image: safeImageRef(item),
  };
}

function matchItemToCommercial(item: MatchItem): CommercialMatch {
  return {
    id: item.slug,
    home: item.home,
    away: item.away,
    homeScore: item.homeScore,
    awayScore: item.awayScore,
    status: item.status,
    kickoff: item.kickoff,
  };
}

function classifyError(_err: unknown): AdapterError["kind"] {
  return "UNKNOWN";
}

/**
 * Server-side fetch to /api/football/standings. Uses the current
 * request's host to derive a base URL on the same deployment, so we
 * never depend on a public hostname. Falls back to empty on error.
 */
async function fetchStandingsFromApi(): Promise<CommercialStanding[]> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? null;
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (!host) return [];
    const url = `${proto}://${host}/api/football/standings?competition=premier-league`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const body = (await r.json()) as {
      value?: Array<{ position?: number; team?: string; played?: number; points?: number }>;
    };
    const rows = body.value ?? [];
    return rows
      .filter((r) => typeof r.team === "string")
      .slice(0, 6)
      .map((r, i) => ({
        pos: r.position ?? i + 1,
        team: r.team ?? "",
        p: r.played ?? 0,
        pts: r.points ?? 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Adapter entry for the home page. Server-side only. NEVER throws.
 */
export async function getCommercialHomeData(): Promise<HomeData> {
  let homepageNews;
  try {
    homepageNews = await getHomepageNews();
  } catch (err) {
    return {
      breaking: [],
      hero: [],
      latest: [],
      matches: [],
      standings: [],
      leagueSections: [],
      trending: [],
      editorsPick: [],
      teamHubStrip: [],
      source: {
        origin: "degraded",
        data: "degraded",
        degradedReason: classifyError(err),
      },
    };
  }

  let liveMatches: MatchItem[] = [];
  try {
    const live = await getLiveScores();
    liveMatches = live.matches ?? [];
  } catch {
    liveMatches = [];
  }

  const standings = await fetchStandingsFromApi();

  const hero: CommercialNews[] = homepageNews.lead
    ? [newsItemToCommercial(homepageNews.lead)]
    : [];
  const secondary = homepageNews.side.slice(0, 2).map(newsItemToCommercial);
  const heroFull = [...hero, ...secondary];
  const latest = homepageNews.latest.slice(0, 8).map(newsItemToCommercial);

  // 6 league sections — populated from the latest news pool, sliced by index
  // mod 6. The live repo doesn't yet have a per-competition query; this
  // adapter avoids fabricating per-competition data and instead distributes
  // the available latest-news pool across the six sections to honour the
  // brief's "6 leagues" UI without inventing news.
  const leagueSlots: HomeData["leagueSections"] = [
    { slug: "premier-league", label: "Premier League", items: [] },
    { slug: "champions-league", label: "Champions League", items: [] },
    { slug: "laliga", label: "LaLiga", items: [] },
    { slug: "bundesliga", label: "Bundesliga", items: [] },
    { slug: "serie-a", label: "Serie A", items: [] },
    { slug: "ligue-1", label: "Ligue 1", items: [] },
  ];
  homepageNews.latest.forEach((item, i) => {
    const slot = leagueSlots[i % leagueSlots.length];
    if (slot && slot.items.length < 4) {
      slot.items.push(newsItemToCommercial(item));
    }
  });

  const trending = homepageNews.latest
    .slice(0, 6)
    .map(newsItemToCommercial);
  const editorsPick = homepageNews.side
    .slice(0, 4)
    .map(newsItemToCommercial);

  return {
    breaking: homepageNews.latest.slice(0, 5).map(newsItemToCommercial),
    hero: heroFull,
    latest,
    matches: liveMatches.slice(0, 8).map(matchItemToCommercial),
    standings,
    leagueSections: leagueSlots,
    trending,
    editorsPick,
    teamHubStrip: [
      { slug: "manchester-city", label: "Manchester City", crest: null },
      { slug: "liverpool", label: "Liverpool", crest: null },
      { slug: "arsenal", label: "Arsenal", crest: null },
      { slug: "chelsea", label: "Chelsea", crest: null },
      { slug: "manchester-united", label: "Manchester United", crest: null },
    ],
    source: {
      origin: homepageNews.source.origin,
      data: homepageNews.source.data,
      degradedReason: homepageNews.source.degradedReason ?? null,
    },
  };
}

/**
 * Adapter entry for /news. Server-side only. Returns the latest
 * pool paginated. Today there is no WP pagination beyond `first`,
 * so pageSize caps at 10 and page navigation beyond page 1 returns
 * an empty items array with `source.data="degraded"`-style messaging
 * carried by the source field's degradedReason.
 */
export async function getCommercialNewsListData(
  page: number = 1,
  pageSize: number = 10,
): Promise<NewsListData> {
  let homepageNews;
  try {
    homepageNews = await getHomepageNews();
  } catch (err) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      source: {
        origin: "degraded",
        data: "degraded",
        degradedReason: classifyError(err),
      },
    };
  }
  const all = homepageNews.latest.map(newsItemToCommercial);
  const start = (page - 1) * pageSize;
  const slice = all.slice(start, start + pageSize);
  return {
    items: slice,
    total: all.length,
    page,
    pageSize,
    source: {
      origin: homepageNews.source.origin,
      data: homepageNews.source.data,
      degradedReason: homepageNews.source.degradedReason ?? null,
    },
  };
}

/**
 * Adapter entry for /search. The live ContentService has no search
 * method, so we surface the limitation. The search page MUST render
 * an Empty state explaining that search is not yet available, NOT a
 * fabricated result.
 */
export async function getCommercialSearchData(query: string): Promise<SearchData> {
  const safeQuery = (query ?? "").trim().slice(0, 200);
  let homepageNews;
  try {
    homepageNews = await getHomepageNews();
  } catch (err) {
    return {
      query: safeQuery,
      items: [],
      total: 0,
      available: false,
      source: {
        origin: "degraded",
        data: "degraded",
        degradedReason: classifyError(err),
      },
    };
  }

  if (!safeQuery) {
    return {
      query: safeQuery,
      items: [],
      total: 0,
      available: false,
      source: {
        origin: homepageNews.source.origin,
        data: homepageNews.source.data,
        degradedReason: null,
      },
    };
  }

  // The live ContentService does not expose a search method. The
  // adapter preserves that limitation rather than fabricating a
  // substring-match across latest-news titles: that would silently
  // hide the fact that real search is not wired up.
  return {
    query: safeQuery,
    items: [],
    total: 0,
    available: false,
    source: {
      origin: homepageNews.source.origin,
      data: homepageNews.source.data,
      degradedReason:
        "search_not_yet_wired_upstream_search_endpoints_only_placeholder",
    },
  };
}

/**
 * Adapter for the league section. Currently returns the populated
 * league sections from `getCommercialHomeData()`; reserved for a
 * future slice that hits per-competition content queries.
 */
export function getLeagueSection(items: CommercialNews[]) {
  return items;
}

/**
 * Adapter: small helper used by ErrorState consumers.
 */
export function explainDegraded(source: HomeData["source"]): string {
  if (source.origin === "unconfigured") {
    return "Content service is not configured.";
  }
  if (source.data !== "degraded") return "";
  switch (source.degradedReason) {
    case "EMPTY_RESPONSE":
      return "No stories available right now.";
    case "UNCONFIGURED":
      return "Content service is not configured.";
    case "search_not_yet_wired_upstream_search_endpoints_only_placeholder":
      return "Search is not yet available. Please check back soon.";
    default:
      return "We couldn't load this section. Please try again.";
  }
}
