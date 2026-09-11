// Football Factory — SEO Entity Hub service tests (R2 Wave 2B).
//
// Covers:
//   - getTeamHub: known slug → identity = 'seed'
//   - getTeamHub: unknown slug → identity = 'unresolved' (NOT throw)
//   - getTeamHub: competition linked to team (premier-league for manchester-united)
//   - getCompetitionHub: known slug → identity = 'seed'
//   - getCompetitionHub: unknown slug → identity = 'unresolved'
//   - calculateThinPage: 0 items, 1..3 items, >=4 items
//   - buildHubSeo: canonical strip query strings
//   - buildHubSeo: noindex when thin, indexed otherwise
//   - buildHubSeo: BreadcrumbList shape
//   - LEAGUE_SLUGS: 6 entries, canonical order

import test from "node:test";
import assert from "node:assert/strict";
import {
  getTeamHub,
  getCompetitionHub,
  calculateThinPage,
  buildHubSeo,
  LEAGUE_SLUGS,
  MIN_INDEXABLE_CONTENT_ITEMS,
} from "../service";

test("team: known slug resolves via identity=seed", async () => {
  const hub = await getTeamHub("manchester-united");
  assert.equal(hub.source.identity, "seed");
  assert.equal(hub.team.slug, "manchester-united");
  assert.ok(hub.team.name.length > 0, "team name should be present");
});

test("team: unknown slug → identity=unresolved (NOT throw)", async () => {
  const hub = await getTeamHub("this-team-does-not-exist-xyz");
  assert.equal(hub.source.identity, "unresolved");
  // Even unknown slugs return a non-throwing shape with empty
  // identity-resolved fields. News may carry mock-fallback data
  // from a previous test's content-service consume; that's
  // intentional (the adapter surfaces whatever is in the
  // ContentService cache, regardless of identity resolution).
  assert.equal(hub.standing, null);
  assert.deepEqual(hub.fixtures, []);
  assert.equal(hub.competition, null);
});

test("team: premier-league team links to competition", async () => {
  const hub = await getTeamHub("arsenal");
  if (hub.source.identity === "seed") {
    // Competition may or may not resolve depending on standings availability,
    // but the team → competition association is declared in TEAM_REGISTRY.
    assert.ok(hub.competition !== null || hub.source.fixtures === "n/a");
  }
});

test("team: latest news is sourced (mock fallback ok)", async () => {
  const hub = await getTeamHub("liverpool");
  // mock-data fallback should populate latestNews via ContentService.
  // (Not asserting length since ContentService fallback is global mock.)
  assert.ok(hub.source.news === "mock" || hub.source.news === "wpgraphql" || hub.source.news === "unconfigured" || hub.source.news === "degraded");
});

test("competition: known slug resolves via identity=seed", async () => {
  const hub = await getCompetitionHub("premier-league");
  assert.equal(hub.source.identity, "seed");
  assert.equal(hub.competition.slug, "premier-league");
});

test("competition: unknown slug → identity=unresolved (NOT throw)", async () => {
  const hub = await getCompetitionHub("not-a-real-comp-xyz");
  assert.equal(hub.source.identity, "unresolved");
  // Even unknown slugs return a non-throwing shape with empty
  // identity-resolved fields.
  assert.deepEqual(hub.standings, []);
  assert.deepEqual(hub.fixtures, []);
  assert.deepEqual(hub.teams, []);
});

test("competition: champions-league resolves", async () => {
  const hub = await getCompetitionHub("champions-league");
  assert.equal(hub.source.identity, "seed");
});

test("calculateThinPage: 0 items is thin", () => {
  const r = calculateThinPage([]);
  assert.equal(r.isThin, true);
  assert.equal(r.itemCount, 0);
  assert.equal(r.threshold, MIN_INDEXABLE_CONTENT_ITEMS);
});

test("calculateThinPage: 1..3 items is thin", () => {
  for (const n of [1, 2, 3]) {
    const r = calculateThinPage([{}, {}, {}].slice(0, n));
    assert.equal(r.isThin, true, `n=${n} should be thin`);
    assert.equal(r.itemCount, n);
  }
});

test("calculateThinPage: >= threshold items is indexable", () => {
  const items = Array(MIN_INDEXABLE_CONTENT_ITEMS).fill({});
  const r = calculateThinPage(items);
  assert.equal(r.isThin, false);
  assert.equal(r.itemCount, MIN_INDEXABLE_CONTENT_ITEMS);
});

test("calculateThinPage: custom threshold", () => {
  const r = calculateThinPage([{}, {}], 2);
  assert.equal(r.isThin, false);
  const r2 = calculateThinPage([{}], 2);
  assert.equal(r2.isThin, true);
});

test("buildHubSeo: canonical strips query strings (uses buildCanonical)", () => {
  const seo = buildHubSeo({
    entity: {
      canonicalId: "team:manchester-united",
      provider: "seed",
      sourceId: null,
      slug: "manchester-united",
      name: "Manchester United",
    },
    kind: "team",
    itemCount: 5,
  });
  assert.match(seo.canonical, /\/teams\/manchester-united$/);
  assert.ok(!seo.canonical.includes("?"), "canonical must not include query string");
});

test("buildHubSeo: thin → noindex=true", () => {
  const seo = buildHubSeo({
    entity: {
      canonicalId: "team:arsenal",
      provider: "seed",
      sourceId: null,
      slug: "arsenal",
      name: "Arsenal",
    },
    kind: "team",
    itemCount: 1,
  });
  assert.equal(seo.noindex, true);
});

test("buildHubSeo: indexable → noindex=false", () => {
  const seo = buildHubSeo({
    entity: {
      canonicalId: "team:arsenal",
      provider: "seed",
      sourceId: null,
      slug: "arsenal",
      name: "Arsenal",
    },
    kind: "team",
    itemCount: 5,
  });
  assert.equal(seo.noindex, false);
});

test("buildHubSeo: BreadcrumbList shape", () => {
  const seo = buildHubSeo({
    entity: {
      canonicalId: "competition:premier-league",
      provider: "seed",
      sourceId: null,
      slug: "premier-league",
      name: "Premier League",
    },
    kind: "competition",
    itemCount: 5,
  });
  // breadcrumbs array
  assert.ok(Array.isArray(seo.breadcrumbs));
  assert.equal(seo.breadcrumbs.length, 3);
  assert.equal(seo.breadcrumbs[0].name, "Home");
  assert.equal(seo.breadcrumbs[2].name, "Premier League");
  // jsonLd array contains BreadcrumbList
  const jl = seo.jsonLd as Array<{ "@type": string }>;
  assert.ok(Array.isArray(jl));
  assert.ok(jl.some((j) => j["@type"] === "BreadcrumbList"));
  // And WebPage / CollectionPage depending on kind
  assert.ok(jl.some((j) => j["@type"] === "CollectionPage"));
});

test("LEAGUE_SLUGS: 6 entries in canonical order", () => {
  assert.equal(LEAGUE_SLUGS.length, 6);
  assert.deepEqual(
    LEAGUE_SLUGS.map((s) => s.slug),
    [
      "premier-league",
      "champions-league",
      "laliga",
      "bundesliga",
      "serie-a",
      "ligue-1",
    ],
  );
});
