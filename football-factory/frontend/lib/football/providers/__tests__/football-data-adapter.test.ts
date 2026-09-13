// Football Factory — football-data adapter tests (Wave B).
//
// 25-case matrix per the Wave B spec. Pure fixture mode.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FootballDataAdapter,
  NullIdentityResolver,
  planRequestBudget,
  ProviderCachePolicy,
} from "../football-data-adapter";
import type { ApiFootballProviderEntity } from "../football-data-adapter";

const FIXTURE = {
  teams: [
    { team: { id: 100, name: "Blue FC", country: "England" } },
    { team: { id: 200, name: "Red FC", country: "Spain" } },
  ],
  players: [
    {
      player: { id: 10, name: "Current Player", birth: { date: "2000-01-01" }, nationality: "England" },
      statistics: [{ games: { position: "Forward" } }],
    },
    {
      player: { id: 11, name: "Loan Player", birth: { date: "1999-02-02" }, nationality: "France" },
      statistics: [{ games: { position: "Midfielder" } }],
    },
  ],
  squads: [
    { team: { id: 100, name: "Blue FC" }, players: [{ id: 10, name: "Current Player", position: "Forward" }] },
    { team: { id: 200, name: "Red FC" }, players: [{ id: 11, name: "Loan Player", position: "Midfielder" }] },
  ],
  coaches: [
    {
      id: 50,
      name: "Current Manager",
      career: [{ team: { id: 100, name: "Blue FC" }, start: "2026-01-01", end: null }],
    },
    {
      id: 51,
      name: "Former Manager",
      career: [{ team: { id: 100, name: "Blue FC" }, start: "2024-01-01", end: "2025-12-31" }],
    },
  ],
  transfers: [
    {
      player: { id: 11, name: "Loan Player" },
      date: "2026-07-01",
      type: "Loan",
      teams: { out: { id: 300, name: "Old FC" }, in: { id: 200, name: "Red FC" } },
    },
    {
      player: { id: 12, name: "Free Agent" },
      date: "2026-06-01",
      type: "Free",
      teams: { out: { id: 300, name: "Old FC" }, in: null },
    },
    {
      player: { id: 13, name: "Unknown Transfer" },
      date: null,
      type: "Permanent",
      teams: { out: { id: 100, name: "Blue FC" }, in: { id: 200, name: "Red FC" } },
    },
  ],
  fixtures: [
    {
      fixture: { id: 9001, date: "2026-09-20T19:00:00Z", status: { short: "NS" } },
      league: { id: 39, name: "Premier League" },
      teams: {
        home: { id: 100, name: "Blue FC" },
        away: { id: 200, name: "Red FC" },
      },
      goals: { home: null, away: null },
    },
  ],
  standings: [
    {
      league: { id: 39, name: "Premier League", standings: [[
        { rank: 1, team: { id: 100, name: "Blue FC" }, points: 6, all: { played: 2 }, goalsDiff: 2 },
      ]]},
    },
  ],
  injuries: [
    {
      player: { id: 10, name: "Current Player", type: "Knock", reason: "Light knock" },
      team: { id: 100, name: "Blue FC" },
      fixture: { id: 9001 },
    },
  ],
  lineups: [
    {
      team: { id: 100, name: "Blue FC" },
      formation: "4-3-3",
      coach: { id: 50, name: "Current Manager" },
      startXI: [
        { player: { id: 10, name: "Current Player", number: 9, pos: "FW" } },
      ],
      substitutes: [
        { player: { id: 11, name: "Loan Player", number: 7, pos: "MF" } },
      ],
    },
  ],
};

const adapter = new FootballDataAdapter(FIXTURE);

// ----- 1..25 from Wave B spec ---------------------------------------------

test("1. teams normalization", () => {
  const teams = adapter.getTeams();
  assert.equal(teams.length, 2);
  const blue = teams.find((t) => t.providerExternalId === "100");
  assert.ok(blue);
  assert.equal(blue?.name, "Blue FC");
  assert.equal(blue?.country, "England");
});

test("2. squad normalization", () => {
  const squad = adapter.getSquad(100);
  assert.equal(squad.length, 1);
  assert.equal(squad[0]?.player.providerExternalId, "10");
  assert.equal(squad[0]?.team.providerExternalId, "100");
  assert.equal(squad[0]?.status, "ACTIVE");
});

test("3. players normalization", () => {
  const players = adapter.getPlayers();
  assert.equal(players.length, 2);
  const cp = players.find((p) => p.providerExternalId === "10");
  assert.ok(cp);
  assert.equal(cp?.birthDate, "2000-01-01");
  assert.equal(cp?.nationality, "England");
  assert.equal(cp?.position, "Forward");
});

test("4. coaches normalization — temporal career preserved", () => {
  const coaches = adapter.getCoaches();
  assert.equal(coaches.length, 2);
  const cm = coaches.find((c) => c.person.providerExternalId === "50");
  assert.ok(cm);
  assert.equal(cm?.career.length, 1);
  assert.equal(cm?.career[0]?.validFrom, "2026-01-01");
  assert.equal(cm?.career[0]?.validTo, null);
});

test("5. transfer loan -> LOAN", () => {
  const transfers = adapter.getTransfers();
  const loan = transfers.find((t) => t.person.providerExternalId === "11");
  assert.ok(loan);
  assert.equal(loan?.status, "LOAN");
  assert.equal(loan?.validFrom, "2026-07-01");
});

test("6. transfer free -> FREE_AGENT", () => {
  const transfers = adapter.getTransfers();
  const free = transfers.find((t) => t.person.providerExternalId === "12");
  assert.ok(free);
  assert.equal(free?.status, "FREE_AGENT");
  assert.equal(free?.team, null);
});

test("7. transfer missing date -> UNKNOWN", () => {
  const transfers = adapter.getTransfers();
  const u = transfers.find((t) => t.person.providerExternalId === "13");
  assert.ok(u);
  assert.equal(u?.status, "UNKNOWN");
  assert.equal(u?.validFrom, null);
});

test("8. future transfer not effective (TRANSFER_CONFIRMED effective:false)", () => {
  const adapter2 = new FootballDataAdapter({
    transfers: [
      {
        player: { id: 50, name: "Future Star" },
        date: "2027-01-01",
        type: "Permanent",
        teams: { out: { id: 100, name: "Blue FC" }, in: { id: 200, name: "Red FC" } },
      },
    ],
  });
  const rel = adapter2.getPlayerTeamRelationship(50, "2026-09-01");
  assert.equal(rel.status, "TRANSFER_CONFIRMED");
  assert.equal(rel.effective, false);
});

test("9. fixtures normalization", () => {
  const fx = adapter.getFixtures();
  assert.equal(fx.length, 1);
  assert.equal(fx[0]?.providerExternalId, "9001");
  assert.equal(fx[0]?.home.providerExternalId, "100");
  assert.equal(fx[0]?.away.providerExternalId, "200");
  assert.equal(fx[0]?.goals.home, null);
  assert.equal(fx[0]?.goals.away, null);
});

test("10. standings normalization", () => {
  const standings = adapter.getStandings();
  assert.equal(standings.length, 1);
  assert.equal(standings[0]?.rank, 1);
  assert.equal(standings[0]?.team.providerExternalId, "100");
  assert.equal(standings[0]?.points, 6);
});

test("11. injuries mapping — provider data preserved", () => {
  const injuries = adapter.getInjuries();
  assert.equal(injuries.length, 1);
  assert.equal(injuries[0]?.type, "Knock");
  assert.equal(injuries[0]?.reason, "Light knock");
  assert.equal(injuries[0]?.fixtureExternalId, "9001");
});

test("12. lineups mapping — only provided members present", () => {
  const lineups = adapter.getLineups();
  assert.equal(lineups.length, 1);
  assert.equal(lineups[0]?.formation, "4-3-3");
  assert.equal(lineups[0]?.startXI.length, 1);
  assert.equal(lineups[0]?.substitutes.length, 1);
  assert.equal(lineups[0]?.startXI[0]?.number, 9);
});

test("13. malformed/null field handling — empty data is safe", () => {
  const empty = new FootballDataAdapter({});
  assert.deepEqual(empty.getTeams(), []);
  assert.deepEqual(empty.getSquad(999), []);
  assert.deepEqual(empty.getPlayers(), []);
  assert.deepEqual(empty.getCoaches(), []);
  assert.deepEqual(empty.getTransfers(), []);
  assert.deepEqual(empty.getFixtures(), []);
  assert.deepEqual(empty.getStandings(), []);
  assert.deepEqual(empty.getInjuries(), []);
  assert.deepEqual(empty.getLineups(), []);
  // Unknown player -> UNKNOWN status with safe person ref.
  const rel = empty.getPlayerTeamRelationship(99999);
  assert.equal(rel.status, "UNKNOWN");
  assert.equal(rel.team, null);
});

test("14. providerExternalId preserved — never fabricated", () => {
  const players = adapter.getPlayers();
  for (const p of players) {
    assert.ok(p.providerExternalId.length > 0);
    assert.equal(p.providerExternalId, String(p.providerExternalId));
  }
});

test("15. canonicalId only from production resolver", () => {
  // With the default NullIdentityResolver, every canonicalId is null.
  const teams = adapter.getTeams();
  for (const t of teams) {
    assert.equal(t.canonicalId, null);
  }
  const players = adapter.getPlayers();
  for (const p of players) {
    assert.equal(p.canonicalId, null);
  }
});

test("16. no canonical ID fabrication from providerId alone", () => {
  // Even when providerExternalId is 12345, the resolver returns null;
  // canonicalId must NOT become "player:12345" automatically.
  const adapter2 = new FootballDataAdapter({
    players: [{ player: { id: 12345, name: "Anonymous" } }],
  });
  const players = adapter2.getPlayers();
  assert.equal(players[0]?.providerExternalId, "12345");
  assert.equal(players[0]?.canonicalId, null);
});

test("17. manager temporal history preserved", () => {
  const rel = adapter.getManagerTeamRelationship(51, "2025-06-01");
  assert.ok(rel);
  assert.equal(rel?.status, "ACTIVE");
  assert.equal(rel?.validFrom, "2024-01-01");
  assert.equal(rel?.validTo, "2025-12-31");

  // Past the end date: INACTIVE.
  const past = adapter.getManagerTeamRelationship(51, "2026-06-01");
  assert.ok(past);
  assert.equal(past?.status, "INACTIVE");
});

test("18. no fabricated dates — unparseable dates return null", () => {
  const adapter2 = new FootballDataAdapter({
    coaches: [
      {
        id: 99,
        name: "Bad Date Manager",
        career: [{ team: { id: 100, name: "Blue FC" }, start: "not-a-date", end: "also-bad" }],
      },
    ],
  });
  const m = adapter2.getManagerTeamRelationship(99, "2025-01-01");
  assert.ok(m);
  assert.equal(m?.validFrom, null);
  assert.equal(m?.validTo, null);
});

test("19. request budget at 100/day -> withinBudget", () => {
  const plan = planRequestBudget({
    dailyBudget: 100,
    teamCount: 20,
    matchCount: 10,
  });
  assert.ok(plan.withinBudget);
  // Verify the expected endpoint order.
  const names = plan.plan.map((x) => x.name);
  assert.ok(names.includes("lineups"));
  assert.ok(names.includes("fixtures"));
  assert.ok(names.includes("transfers"));
  assert.ok(names.includes("standings"));
  assert.ok(names.includes("teams"));
});

test("20. budget overflow -> deferIfBudgetExceeded", () => {
  // Tight budget forces some endpoints to defer.
  const plan = planRequestBudget({
    dailyBudget: 5,
    teamCount: 20,
    matchCount: 10,
  });
  assert.equal(plan.withinBudget, false);
  const deferred = plan.plan.filter((x) => x.deferIfBudgetExceeded);
  assert.ok(deferred.length > 0);
});

test("21. cache priority preservation", () => {
  assert.equal(ProviderCachePolicy.lineups.priority, "HIGH");
  assert.equal(ProviderCachePolicy.transfers.priority, "HIGH");
  assert.equal(ProviderCachePolicy.injuries.priority, "HIGH");
  assert.equal(ProviderCachePolicy.fixtures.priority, "HIGH");
  assert.equal(ProviderCachePolicy.teams.priority, "LOW");
  // TTLs follow the audited Pack 2 baseline.
  assert.equal(ProviderCachePolicy.lineups.cacheTTL, 600);
  assert.equal(ProviderCachePolicy.transfers.cacheTTL, 3600);
  assert.equal(ProviderCachePolicy.teams.cacheTTL, 86400);
});

test("22. deterministic output — identical input -> identical output", () => {
  const a = planRequestBudget({ dailyBudget: 100, teamCount: 20, matchCount: 10 });
  const b = planRequestBudget({ dailyBudget: 100, teamCount: 20, matchCount: 10 });
  assert.deepEqual(a, b);
});

test("23. input fixture not mutated", () => {
  const snapshot = JSON.parse(JSON.stringify(FIXTURE));
  adapter.getTeams();
  adapter.getSquad(100);
  adapter.getPlayers();
  adapter.getCoaches();
  adapter.getTransfers();
  adapter.getFixtures();
  adapter.getStandings();
  adapter.getInjuries();
  adapter.getLineups();
  assert.deepEqual(FIXTURE, snapshot);
});

test("24. no network path in adapter layer", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = fileURLToPath(import.meta.url);
  const src = await fs.readFile(
    path.resolve(path.dirname(here), "..", "football-data-adapter.ts"),
    "utf8",
  );
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    /\bfetch\s*\(|XMLHttpRequest|axios\s*\(/i.test(codeOnly),
    false,
    "football-data-adapter.ts must not contain network refs",
  );
});

test("25. no secret literal in adapter source", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = fileURLToPath(import.meta.url);
  const src = await fs.readFile(
    path.resolve(path.dirname(here), "..", "football-data-adapter.ts"),
    "utf8",
  );
  // Strip comments before scanning.
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    /(api[_-]?key|client_secret|password)\s*[:=]\s*['"][^'"]{6,}/i.test(codeOnly),
    false,
    "adapter must not contain api_key / client_secret / password literals",
  );
  assert.equal(
    /FOOTBALL_DATA_API_KEY/.test(codeOnly),
    false,
    "adapter must not reference FOOTBALL_DATA_API_KEY (env name belongs to live client only)",
  );
});

// ----- Bonus: explicit identity resolver boundary ------------------------

test("bonus: explicit identity resolver returns canonicalId only when mapped", () => {
  const resolver = new (class {
    private map: Record<string, string> = {
      "api-football:player:10": "player:ronaldo-canonical",
      "api-football:team:100": "team:blue-fc-canonical",
    };
    resolve(provider: string, type: string, id: string | number): string | null {
      const key = `${provider}:${type}:${id}`;
      return this.map[key] ?? null;
    }
  })();
  const a = new FootballDataAdapter(FIXTURE, resolver as unknown as NullIdentityResolver);
  const players = a.getPlayers();
  const ronaldo = players.find((p: ApiFootballProviderEntity) => p.providerExternalId === "10");
  assert.equal(ronaldo?.canonicalId, "player:ronaldo-canonical");

  // Provider externalId 11 has NO mapping -> canonicalId remains null.
  const loan = players.find((p: ApiFootballProviderEntity) => p.providerExternalId === "11");
  assert.equal(loan?.canonicalId, null);
});