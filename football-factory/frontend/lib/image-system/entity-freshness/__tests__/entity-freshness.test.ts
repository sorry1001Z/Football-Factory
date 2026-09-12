// Football Factory — Entity Freshness Gate tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateBannerPersonEligibility,
  evaluateBannerCombination,
} from "../banner-eligibility";
import {
  DEFAULT_MAX_STALENESS_DAYS,
  daysBetween,
  findRelationship,
  isActiveAt,
  isFormerAt,
  isStale,
  parseArticleDate,
  relationshipsOverlapAtDate,
  visualContextFromRelationship,
} from "../person-team-validity";
import { StaticRosterProvider } from "../roster-provider";
import type {
  BannerPersonContext,
  PersonTeamRelationship,
} from "../types";

// ============================================================================
// Fixtures
// ============================================================================

const TEAM_MU = "team:manchester-united";
const TEAM_LIVERPOOL = "team:liverpool";
const TEAM_BARCELONA = "team:barcelona";

const RONALDO: PersonTeamRelationship = {
  personId: "person:ronaldo",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "ACTIVE",
  validFrom: "2003-08-12",
  validTo: "2009-06-11",
  source: "wikipedia",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const RASHFORD: PersonTeamRelationship = {
  personId: "person:rashford",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "ACTIVE",
  validFrom: "2016-02-01",
  source: "wikipedia",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const TEN_HAG: PersonTeamRelationship = {
  personId: "person:ten_hag",
  teamId: TEAM_MU,
  role: "MANAGER",
  status: "ACTIVE",
  validFrom: "2022-07-01",
  validTo: "2024-10-28",
  source: "wikipedia",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const RANGNICK: PersonTeamRelationship = {
  personId: "person:rangnick",
  teamId: TEAM_MU,
  role: "MANAGER",
  status: "INACTIVE",
  validFrom: "2021-12-01",
  validTo: "2022-06-30",
  source: "wikipedia",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const TRANSFER_PENDING_PLAYER: PersonTeamRelationship = {
  personId: "person:mbappe",
  teamId: TEAM_LIVERPOOL,
  role: "PLAYER",
  status: "TRANSFER_PENDING",
  validFrom: "2025-07-01",
  source: "rumor",
  verifiedAt: "2025-06-15T00:00:00Z",
};
const TRANSFERRED_PLAYER: PersonTeamRelationship = {
  personId: "person:saka",
  teamId: TEAM_BARCELONA,
  role: "PLAYER",
  status: "TRANSFER_CONFIRMED",
  validFrom: "2025-07-01",
  source: "club-official",
  verifiedAt: "2025-07-02T00:00:00Z",
};

const ROSTER: PersonTeamRelationship[] = [
  RONALDO,
  RASHFORD,
  TEN_HAG,
  RANGNICK,
  TRANSFER_PENDING_PLAYER,
  TRANSFERRED_PLAYER,
];

function person(
  personId: string,
  currentTeamId?: string,
  displayName?: string,
): BannerPersonContext {
  return {
    personId,
    currentTeamId,
    displayName,
    role: "PLAYER",
    visualContext: "CURRENT_CLUB",
    articleDate: "2024-09-01",
  };
}

// ============================================================================
// Date helpers
// ============================================================================

test("parseArticleDate: YYYY-MM-DD parses to UTC midnight", () => {
  assert.equal(parseArticleDate("2024-09-01"), Date.UTC(2024, 8, 1));
});

test("parseArticleDate: full ISO parses", () => {
  assert.equal(parseArticleDate("2024-09-01T12:00:00Z"), Date.UTC(2024, 8, 1, 12));
});

test("parseArticleDate: invalid returns NaN", () => {
  assert.equal(Number.isNaN(parseArticleDate("not-a-date")), true);
  assert.equal(Number.isNaN(parseArticleDate("")), true);
});

test("daysBetween: positive when later > earlier", () => {
  assert.equal(daysBetween("2024-09-10", "2024-09-01"), 9);
});

// ============================================================================
// Temporal validity
// ============================================================================

test("isActiveAt: ACTIVE inside window", () => {
  assert.equal(isActiveAt(RASHFORD, "2024-09-01"), true);
});

test("isActiveAt: ACTIVE before validFrom returns false", () => {
  assert.equal(isActiveAt(RASHFORD, "2015-01-01"), false);
});

test("isActiveAt: ACTIVE after validTo returns false", () => {
  assert.equal(isActiveAt(RONALDO, "2024-09-01"), false);
});

test("isActiveAt: TRANSFER_PENDING returns false (not yet a member)", () => {
  assert.equal(isActiveAt(TRANSFER_PENDING_PLAYER, "2024-09-01"), false);
});

test("isActiveAt: TRANSFER_CONFIRMED at validFrom is true", () => {
  assert.equal(isActiveAt(TRANSFERRED_PLAYER, "2025-07-01"), true);
});

test("isActiveAt: UNKNOWN returns false (never guesses)", () => {
  const unknown: PersonTeamRelationship = {
    personId: "x",
    teamId: "y",
    role: "PLAYER",
    status: "UNKNOWN",
  };
  assert.equal(isActiveAt(unknown, "2024-09-01"), false);
});

test("isFormerAt: person who left before article date", () => {
  assert.equal(isFormerAt(RONALDO, "2024-09-01"), true);
});

test("isFormerAt: still-active player is not former", () => {
  assert.equal(isFormerAt(RASHFORD, "2024-09-01"), false);
});

test("relationshipsOverlapAtDate: manager and player active together", () => {
  // On 2023-08-01 both TEN_HAG and RASHFORD are active.
  assert.equal(
    relationshipsOverlapAtDate(TEN_HAG, RASHFORD, "2023-08-01"),
    true,
  );
});

test("relationshipsOverlapAtDate: tenure mismatch returns false", () => {
  // On 2024-12-01 TEN_HAG has been sacked; RASHFORD still active.
  assert.equal(
    relationshipsOverlapAtDate(TEN_HAG, RASHFORD, "2024-12-01"),
    false,
  );
});

test("isStale: very old verifiedAt is stale", () => {
  // RONALDO verifiedAt=2024-08-25; articleDate=2024-09-01 with 7d
  // max-staleness => stale (gap=7d > 7d strictly).
  assert.equal(isStale(RONALDO, "2024-09-01", 6), true);
});

test("isStale: fresh verifiedAt is not stale", () => {
  assert.equal(isStale(RASHFORD, "2024-08-05", 30), false);
});

test("isStale: missing verifiedAt is stale", () => {
  const rel: PersonTeamRelationship = {
    personId: "x",
    teamId: "y",
    role: "PLAYER",
    status: "ACTIVE",
  };
  assert.equal(isStale(rel, "2024-09-01"), true);
});

test("DEFAULT_MAX_STALENESS_DAYS is finite and > 0", () => {
  assert.ok(Number.isFinite(DEFAULT_MAX_STALENESS_DAYS));
  assert.ok(DEFAULT_MAX_STALENESS_DAYS > 0);
});

test("visualContextFromRelationship: ACTIVE -> CURRENT_CLUB", () => {
  assert.equal(visualContextFromRelationship(RASHFORD, "2024-09-01"), "CURRENT_CLUB");
});

test("visualContextFromRelationship: FORMER -> FORMER_CLUB", () => {
  assert.equal(visualContextFromRelationship(RONALDO, "2024-09-01"), "FORMER_CLUB");
});

test("visualContextFromRelationship: TRANSFER_PENDING -> TARGET_CLUB", () => {
  assert.equal(
    visualContextFromRelationship(TRANSFER_PENDING_PLAYER, "2024-09-01"),
    "TARGET_CLUB",
  );
});

test("visualContextFromRelationship: TRANSFER_CONFIRMED at date -> NEW_CLUB", () => {
  assert.equal(
    visualContextFromRelationship(TRANSFERRED_PLAYER, "2025-07-15"),
    "NEW_CLUB",
  );
});

test("visualContextFromRelationship: null -> FORMER_CLUB safe default", () => {
  assert.equal(visualContextFromRelationship(null, "2024-09-01"), "FORMER_CLUB");
});

test("findRelationship: returns most-recent verified match", () => {
  const newer: PersonTeamRelationship = {
    ...RASHFORD,
    verifiedAt: "2024-09-01T00:00:00Z",
  };
  const out = findRelationship([RASHFORD, newer], "person:rashford", TEAM_MU);
  assert.equal(out?.verifiedAt, "2024-09-01T00:00:00Z");
});

test("findRelationship: missing returns null", () => {
  assert.equal(findRelationship(ROSTER, "ghost", TEAM_MU), null);
});

// ============================================================================
// Banner eligibility — single person
// ============================================================================

test("evaluateBannerPersonEligibility: CURRENT player + CURRENT_NEWS => ELIGIBLE", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:rashford", TEAM_MU, "Rashford"),
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.eligible, true);
  assert.equal(r.decision, "ELIGIBLE");
  assert.equal(r.visualContext, "CURRENT_CLUB");
  assert.ok(r.reasons.includes("ACTIVE_AT_DATE"));
});

test("evaluateBannerPersonEligibility: FORMER player + CURRENT_NEWS => NOT_ELIGIBLE", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:ronaldo", TEAM_MU, "Ronaldo"),
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.eligible, false);
  assert.equal(r.decision, "NOT_ELIGIBLE");
  assert.ok(r.reasons.includes("FORMER_AT_DATE"));
});

test("evaluateBannerPersonEligibility: FORMER player + HISTORICAL => ELIGIBLE", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:ronaldo", TEAM_MU, "Ronaldo"),
    articleType: "HISTORICAL",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.eligible, true);
  assert.equal(r.decision, "ELIGIBLE");
  assert.equal(r.visualContext, "HISTORICAL_SUBJECT");
  assert.ok(r.reasons.includes("HISTORICAL_EXCEPTION"));
});

test("evaluateBannerPersonEligibility: PROFILE about a former player => ELIGIBLE with former context", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:ronaldo", TEAM_MU, "Ronaldo"),
    articleType: "PROFILE",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.eligible, true);
  assert.equal(r.decision, "ELIGIBLE");
  assert.equal(r.visualContext, "FORMER_CLUB");
  assert.ok(r.reasons.includes("PROFILE_SUBJECT_FORMER"));
});

test("evaluateBannerPersonEligibility: TRANSFER_PENDING player + TRANSFER_NEWS => ELIGIBLE as CURRENT_CLUB", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:mbappe", TEAM_LIVERPOOL, "Mbappe"),
    articleType: "TRANSFER_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_LIVERPOOL],
    roster: ROSTER,
  });
  assert.equal(r.eligible, true);
  assert.ok(r.reasons.includes("TRANSFER_PENDING_NO_NEW_CLUB"));
  assert.equal(r.visualContext, "CURRENT_CLUB");
});

test("evaluateBannerPersonEligibility: TRANSFER_CONFIRMED player + TRANSFER_NEWS after effective date => NEW_CLUB", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:saka", TEAM_BARCELONA, "Saka"),
    articleType: "TRANSFER_NEWS",
    articleDate: "2025-07-15",
    teamIds: [TEAM_BARCELONA],
    roster: ROSTER,
  });
  assert.equal(r.eligible, true);
  assert.equal(r.visualContext, "NEW_CLUB");
  assert.ok(r.reasons.includes("TRANSFER_CONFIRMED_NEW_CLUB"));
});

test("evaluateBannerPersonEligibility: TRANSFER_CONFIRMED player + CURRENT_NEWS before effective date => NOT_ELIGIBLE", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:saka", TEAM_BARCELONA, "Saka"),
    articleType: "CURRENT_NEWS",
    articleDate: "2025-06-15",
    teamIds: [TEAM_BARCELONA],
    roster: ROSTER,
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("FORMER_AT_DATE"));
});

test("evaluateBannerPersonEligibility: current MANAGER + CURRENT_NEWS => ELIGIBLE", () => {
  const r = evaluateBannerPersonEligibility({
    person: { ...person("person:ten_hag", TEAM_MU, "Ten Hag"), role: "MANAGER" },
    articleType: "CURRENT_NEWS",
    articleDate: "2023-08-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.eligible, true);
  assert.equal(r.role, "MANAGER");
});

test("evaluateBannerPersonEligibility: FORMER MANAGER + CURRENT_NEWS => NOT_ELIGIBLE", () => {
  const r = evaluateBannerPersonEligibility({
    person: { ...person("person:ten_hag", TEAM_MU, "Ten Hag"), role: "MANAGER" },
    articleType: "CURRENT_NEWS",
    articleDate: "2024-12-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.eligible, false);
});

test("evaluateBannerPersonEligibility: stale data => REQUIRES_REVIEW", () => {
  // RASHFORD verifiedAt=2024-08-01; articleDate=2025-12-01 with 30d
  // max-staleness => stale.
  const r = evaluateBannerPersonEligibility({
    person: person("person:rashford", TEAM_MU, "Rashford"),
    articleType: "CURRENT_NEWS",
    articleDate: "2025-12-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
    maxStalenessDays: 30,
  });
  assert.equal(r.decision, "REQUIRES_REVIEW");
  assert.ok(r.reasons.includes("STALE_DATA"));
});

test("evaluateBannerPersonEligibility: unknown person => REQUIRES_REVIEW (never guesses)", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:ghost", TEAM_MU, "Ghost"),
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.decision, "REQUIRES_REVIEW");
  assert.ok(r.reasons.includes("PERSON_TEAM_UNKNOWN"));
});

test("evaluateBannerPersonEligibility: missing articleDate => REQUIRES_REVIEW", () => {
  const r = evaluateBannerPersonEligibility({
    person: person("person:rashford", TEAM_MU, "Rashford"),
    articleType: "CURRENT_NEWS",
    articleDate: "not-a-date",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.equal(r.decision, "REQUIRES_REVIEW");
});

test("evaluateBannerPersonEligibility: returns confidence in [0,1]", () => {
  const ok = evaluateBannerPersonEligibility({
    person: person("person:rashford", TEAM_MU, "Rashford"),
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  const rev = evaluateBannerPersonEligibility({
    person: person("person:ghost", TEAM_MU, "Ghost"),
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    roster: ROSTER,
  });
  assert.ok(ok.confidence > 0 && ok.confidence <= 1);
  assert.ok(rev.confidence >= 0 && rev.confidence < ok.confidence);
});

// ============================================================================
// Banner combination — manager + player
// ============================================================================

test("evaluateBannerCombination: all valid => all ELIGIBLE", () => {
  const out = evaluateBannerCombination({
    articleType: "CURRENT_NEWS",
    articleDate: "2023-08-01",
    teamIds: [TEAM_MU],
    people: [
      { ...person("person:rashford", TEAM_MU), role: "PLAYER" },
      { ...person("person:ten_hag", TEAM_MU), role: "MANAGER" },
    ],
    roster: ROSTER,
  });
  assert.equal(out.length, 2);
  assert.equal(out.every((r) => r.eligible), true);
  assert.ok(!out[0].reasons.includes("BANNER_COMBINATION_NO_TEMPORAL_OVERLAP"));
  assert.ok(!out[1].reasons.includes("BANNER_COMBINATION_NO_TEMPORAL_OVERLAP"));
});

test("evaluateBannerCombination: mixed valid/invalid => per-person decisions", () => {
  const out = evaluateBannerCombination({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    people: [
      { ...person("person:rashford", TEAM_MU), role: "PLAYER" },
      { ...person("person:ronaldo", TEAM_MU), role: "PLAYER" }, // former
    ],
    roster: ROSTER,
  });
  assert.equal(out[0].eligible, true);
  assert.equal(out[1].eligible, false);
});

test("evaluateBannerCombination: manager/player no temporal overlap flagged", () => {
  // On 2024-12-01 TEN_HAG is sacked; RASHFORD still active. They
  // should not be combined as current colleagues.
  const out = evaluateBannerCombination({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-12-01",
    teamIds: [TEAM_MU],
    people: [
      { ...person("person:rashford", TEAM_MU), role: "PLAYER" },
      { ...person("person:ten_hag", TEAM_MU), role: "MANAGER" },
    ],
    roster: ROSTER,
  });
  // The manager is NOT_ELIGIBLE on its own; the player is REQUIRES_REVIEW
  // (because RASHFORD's verifiedAt=2024-08-01 is stale relative to
  // 2024-12-01 with default 14-day staleness window). Even so, the
  // combination must annotate the no-temporal-overlap reason so the
  // caller can refuse the combo.
  const manager = out.find((r) => r.role === "MANAGER");
  assert.ok(manager);
  assert.ok(manager.reasons.includes("BANNER_COMBINATION_NO_TEMPORAL_OVERLAP"));
});

test("evaluateBannerCombination: empty people => empty result", () => {
  const out = evaluateBannerCombination({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    people: [],
    roster: ROSTER,
  });
  assert.equal(out.length, 0);
});

test("evaluateBannerCombination: single person (no overlap check)", () => {
  const out = evaluateBannerCombination({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    people: [{ ...person("person:rashford", TEAM_MU), role: "PLAYER" }],
    roster: ROSTER,
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].eligible, true);
  assert.ok(!out[0].reasons.includes("BANNER_COMBINATION_NO_TEMPORAL_OVERLAP"));
});

// ============================================================================
// StaticRosterProvider — adapter contract
// ============================================================================

test("StaticRosterProvider: getPlayerTeamRelationship returns PLAYER records only", async () => {
  const p = new StaticRosterProvider(ROSTER);
  const r = await p.getPlayerTeamRelationship({
    personId: "person:rashford",
    teamId: TEAM_MU,
  });
  assert.equal(r?.role, "PLAYER");
});

test("StaticRosterProvider: getManagerTeamRelationship returns MANAGER records only", async () => {
  const p = new StaticRosterProvider(ROSTER);
  const r = await p.getManagerTeamRelationship({
    personId: "person:ten_hag",
    teamId: TEAM_MU,
  });
  assert.equal(r?.role, "MANAGER");
});

test("StaticRosterProvider: getCurrentManager picks latest ACTIVE", async () => {
  const p = new StaticRosterProvider(ROSTER);
  const r = await p.getCurrentManager({ teamId: TEAM_MU });
  assert.equal(r?.personId, "person:ten_hag");
});

test("StaticRosterProvider: getTeamRosterAtDate filters by date", async () => {
  const p = new StaticRosterProvider(ROSTER);
  const list = await p.getTeamRosterAtDate({ teamId: TEAM_MU, date: "2023-08-01" });
  const ids = list.map((r) => r.personId).sort();
  assert.deepEqual(ids, ["person:rashford", "person:ten_hag"]);
});

test("StaticRosterProvider: getPersonHistory returns all matches", async () => {
  const p = new StaticRosterProvider(ROSTER);
  const list = await p.getPersonHistory({ personId: "person:ronaldo" });
  assert.equal(list.length, 1);
});

// ============================================================================
// Defensive — never touches rights/rendering
// ============================================================================

test("entity-freshness modules do not export rights-evaluation symbols", async () => {
  const mod = await import("../index");
  // The freshness module must not re-export any rights-side symbols.
  assert.equal("publicationDecision" in mod, false);
  assert.equal("canDownloadBinary" in mod, false);
  assert.equal("rights_confirmed" in mod, false);
});
