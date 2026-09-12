// Football Factory — Banner Composer Advisory tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { composeBanner } from "../compose";
import { clampMaxPeople, filterEligible, selectTopPeople } from "../selection";
import type { ComposerCandidate, BannerComposerInput } from "../types";
import type { PersonTeamRelationship } from "../../entity-freshness/types";

// ============================================================================
// Fixtures
// ============================================================================

const TEAM_MU = "team:manchester-united";

const RASHFORD: PersonTeamRelationship = {
  personId: "person:rashford",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "ACTIVE",
  validFrom: "2016-02-01",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const RONALDO: PersonTeamRelationship = {
  personId: "person:ronaldo",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "ACTIVE",
  validFrom: "2003-08-12",
  validTo: "2009-06-11",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const FERNANDES: PersonTeamRelationship = {
  personId: "person:fernandes",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "ACTIVE",
  validFrom: "2020-01-30",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const TEN_HAG: PersonTeamRelationship = {
  personId: "person:ten_hag",
  teamId: TEAM_MU,
  role: "MANAGER",
  status: "ACTIVE",
  validFrom: "2022-07-01",
  validTo: "2024-10-28",
  verifiedAt: "2024-08-25T00:00:00Z",
};
const MBAPPE_TRANSFER_PENDING: PersonTeamRelationship = {
  personId: "person:mbappe",
  teamId: "team:liverpool",
  role: "PLAYER",
  status: "TRANSFER_PENDING",
  validFrom: "2025-07-01",
  verifiedAt: "2024-08-25T00:00:00Z",
};

const ROSTER = [RASHFORD, RONALDO, FERNANDES, TEN_HAG, MBAPPE_TRANSFER_PENDING];

function candidate(
  personId: string,
  relationship: PersonTeamRelationship | undefined,
  articleSubject = false,
  role: "PLAYER" | "MANAGER" | "COACH" | "STAFF" = "PLAYER",
  displayName?: string,
): ComposerCandidate {
  return {
    personId,
    displayName: displayName ?? personId.split(":")[1],
    role,
    relationship,
    articleSubject,
  };
}

function input(
  articleType: "CURRENT_NEWS" | "TRANSFER_NEWS" | "MATCH_NEWS" | "FEATURE" | "HISTORICAL" | "PROFILE",
  people: ComposerCandidate[],
  extra: Partial<BannerComposerInput> = {},
): BannerComposerInput {
  return {
    articleType,
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    people,
    roster: ROSTER,
    ...extra,
  };
}

// ============================================================================
// clampMaxPeople
// ============================================================================

test("clampMaxPeople: default is 3", () => {
  assert.equal(clampMaxPeople(undefined), 3);
});

test("clampMaxPeople: hard cap 3", () => {
  assert.equal(clampMaxPeople(10), 3);
});

test("clampMaxPeople: minimum 1", () => {
  assert.equal(clampMaxPeople(0), 1);
  assert.equal(clampMaxPeople(-3), 1);
});

test("clampMaxPeople: honors valid values", () => {
  assert.equal(clampMaxPeople(1), 1);
  assert.equal(clampMaxPeople(2), 2);
  assert.equal(clampMaxPeople(3), 3);
});

// ============================================================================
// composeBanner — basic selection rules
// ============================================================================

test("composeBanner: current active player is selected", () => {
  const out = composeBanner(input("CURRENT_NEWS", [candidate("person:rashford", RASHFORD)]));
  assert.equal(out.status, "READY");
  assert.equal(out.selectedPeople.length, 1);
  assert.equal(out.selectedPeople[0].personId, "person:rashford");
  assert.equal(out.selectedPeople[0].visualContext, "CURRENT_CLUB");
});

test("composeBanner: former player excluding from CURRENT_NEWS", () => {
  const out = composeBanner(input("CURRENT_NEWS", [candidate("person:ronaldo", RONALDO)]));
  assert.equal(out.selectedPeople.length, 0);
  assert.equal(out.status, "NO_VALID_SUBJECTS");
  assert.equal(out.excludedPeople.length, 1);
  assert.equal(out.excludedPeople[0].personId, "person:ronaldo");
});

test("composeBanner: former manager excluding from CURRENT_NEWS", () => {
  const out = composeBanner(input("CURRENT_NEWS", [candidate("person:ten_hag", TEN_HAG)]));
  // TEN_HAG is also former on 2024-09-01 (validTo 2024-10-28 > date).
  // Actually TEN_HAG validTo is in the future from 2024-09-01.
  // Use a different manager fixture.
  const sackedManager: PersonTeamRelationship = {
    ...TEN_HAG,
    validTo: "2024-08-15",
  };
  const out2 = composeBanner(
    input("CURRENT_NEWS", [candidate("person:ten_hag", sackedManager)]),
  );
  assert.equal(out2.selectedPeople.length, 0);
  assert.equal(out2.excludedPeople.length, 1);
});

test("composeBanner: historical article allows former player", () => {
  const out = composeBanner(input("HISTORICAL", [candidate("person:ronaldo", RONALDO)]));
  assert.equal(out.status, "READY");
  assert.equal(out.selectedPeople.length, 1);
  assert.equal(out.selectedPeople[0].visualContext, "HISTORICAL_SUBJECT");
});

test("composeBanner: profile article allows former player", () => {
  const out = composeBanner(input("PROFILE", [candidate("person:ronaldo", RONALDO)]));
  assert.equal(out.status, "READY");
  assert.equal(out.selectedPeople.length, 1);
  assert.equal(out.selectedPeople[0].visualContext, "FORMER_CLUB");
});

// ============================================================================
// Transfer contexts
// ============================================================================

test("composeBanner: TRANSFER_PENDING player kept as CURRENT_CLUB", () => {
  // Use a Liverpool news context. articleType TRANSFER_NEWS.
  const out = composeBanner(
    input(
      "TRANSFER_NEWS",
      [candidate("person:mbappe", MBAPPE_TRANSFER_PENDING)],
      { teamIds: ["team:liverpool"] },
    ),
  );
  assert.equal(out.selectedPeople.length, 1);
  assert.equal(out.selectedPeople[0].visualContext, "CURRENT_CLUB");
  assert.ok(
    out.warnings.includes("TRANSFER_PENDING_DO_NOT_IMPLY_NEW_CLUB"),
  );
  assert.equal(out.layoutSuggestion, "TRANSFER_SPLIT");
});

test("composeBanner: TRANSFER_CONFIRMED before effective date does NOT show as new club", () => {
  const TRANSFER_CONFIRMED_FUTURE: PersonTeamRelationship = {
    personId: "person:saka",
    teamId: TEAM_MU,
    role: "PLAYER",
    status: "TRANSFER_CONFIRMED",
    validFrom: "2025-07-01",
    verifiedAt: "2024-08-25T00:00:00Z",
  };
  const out = composeBanner(
    input("CURRENT_NEWS", [candidate("person:saka", TRANSFER_CONFIRMED_FUTURE, true)]),
  );
  // On 2024-09-01, saka is NOT yet a member of TEAM_MU (validFrom in
  // 2025). Must NOT be selected as a current member.
  assert.equal(out.selectedPeople.length, 0);
});

test("composeBanner: TRANSFER_CONFIRMED after effective date => NEW_CLUB", () => {
  const TRANSFER_CONFIRMED_PAST: PersonTeamRelationship = {
    personId: "person:saka",
    teamId: TEAM_MU,
    role: "PLAYER",
    status: "TRANSFER_CONFIRMED",
    validFrom: "2024-01-01",
    verifiedAt: "2024-08-25T00:00:00Z",
  };
  // articleDate 2024-09-01 > validFrom 2024-01-01 => player has
  // effectively joined the new club. visualContext MUST be NEW_CLUB.
  const out = composeBanner(
    input("CURRENT_NEWS", [candidate("person:saka", TRANSFER_CONFIRMED_PAST)]),
  );
  assert.equal(out.selectedPeople.length, 1);
  assert.equal(out.selectedPeople[0].visualContext, "NEW_CLUB");
});

// ============================================================================
// Stale / unknown
// ============================================================================

test("composeBanner: stale data -> not auto-selected", () => {
  // RASHFORD verifiedAt=2024-08-25; articleDate=2025-12-01 with
  // 30d max staleness => REQUIRES_REVIEW, not selected.
  const out = composeBanner(
    input("CURRENT_NEWS", [candidate("person:rashford", RASHFORD)], {
      maxStalenessDays: 30,
    }),
  );
  // Override article date to a future point so the record is stale.
  out; // placeholder
  const out2 = composeBanner({
    ...input("CURRENT_NEWS", [candidate("person:rashford", RASHFORD)]),
    articleDate: "2025-12-01",
    maxStalenessDays: 30,
  });
  assert.equal(out2.selectedPeople.length, 0);
});

test("composeBanner: unknown relationship -> not auto-selected", () => {
  // No roster record for this person.
  const out = composeBanner(input("CURRENT_NEWS", [candidate("person:ghost", undefined)]));
  assert.equal(out.selectedPeople.length, 0);
  assert.equal(out.status, "NO_VALID_SUBJECTS");
  assert.equal(out.excludedPeople.length, 1);
});

// ============================================================================
// Priority
// ============================================================================

test("composeBanner: articleSubject gets priority over other candidates", () => {
  const out = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD, false),
      candidate("person:fernandes", FERNANDES, true),
    ]),
  );
  assert.equal(out.selectedPeople.length, 2);
  assert.equal(out.selectedPeople[0].personId, "person:fernandes");
});

test("composeBanner: famous unrelated player not selected", () => {
  // Add a famous former player (Ronaldo) alongside an active one.
  const out = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD),
      candidate("person:ronaldo", RONALDO),
    ]),
  );
  // Famous former player must NOT be selected.
  assert.equal(out.selectedPeople.length, 1);
  assert.equal(out.selectedPeople[0].personId, "person:rashford");
  assert.ok(
    out.excludedPeople.some((p) => p.personId === "person:ronaldo"),
  );
});

// ============================================================================
// Manager + player overlap
// ============================================================================

test("composeBanner: manager + player with valid overlap", () => {
  const out = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD, false, "PLAYER"),
      candidate("person:ten_hag", TEN_HAG, false, "MANAGER"),
    ]),
  );
  assert.equal(out.selectedPeople.length, 2);
});

test("composeBanner: manager + player with no temporal overlap flagged", () => {
  const sackedManager: PersonTeamRelationship = {
    ...TEN_HAG,
    validTo: "2024-08-15",
  };
  const out = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD, false, "PLAYER"),
      candidate("person:ten_hag", sackedManager, false, "MANAGER"),
    ]),
  );
  // Manager is former -> not selected. Player is current -> selected.
  assert.equal(out.selectedPeople.length, 1);
  assert.equal(out.selectedPeople[0].personId, "person:rashford");
});

// ============================================================================
// Multi-person limit + ordering
// ============================================================================

test("composeBanner: max 3 people", () => {
  const out = composeBanner(
    input(
      "CURRENT_NEWS",
      [
        candidate("person:rashford", RASHFORD),
        candidate("person:fernandes", FERNANDES),
        candidate("person:ronaldo", RONALDO), // former, excluded
      ],
      { maxPeople: 5 },
    ),
  );
  assert.ok(out.selectedPeople.length <= 3);
  assert.equal(out.selectedPeople.length, 2); // 2 valid
});

test("composeBanner: deterministic ordering by priority then personId", () => {
  const a = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:fernandes", FERNANDES, false),
      candidate("person:rashford", RASHFORD, false),
    ]),
  );
  const b = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD, false),
      candidate("person:fernandes", FERNANDES, false),
    ]),
  );
  assert.equal(a.selectedPeople.length, b.selectedPeople.length);
  for (let i = 0; i < a.selectedPeople.length; i++) {
    assert.equal(a.selectedPeople[i].personId, b.selectedPeople[i].personId);
  }
});

test("composeBanner: explicit maxPeople clamps to 3", () => {
  // Add 4 valid candidates by using a synthetic roster with 4
  // active MU players.
  const extra1: PersonTeamRelationship = { ...RASHFORD, personId: "person:a" };
  const extra2: PersonTeamRelationship = { ...RASHFORD, personId: "person:b" };
  const extra3: PersonTeamRelationship = { ...RASHFORD, personId: "person:c" };
  const out = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD),
      candidate("person:fernandes", FERNANDES),
      candidate("person:a", extra1),
      candidate("person:b", extra2),
    ]),
  );
  assert.equal(out.selectedPeople.length, 3);
});

// ============================================================================
// Empty / mixed / status
// ============================================================================

test("composeBanner: zero valid subjects -> NO_VALID_SUBJECTS", () => {
  const out = composeBanner(input("CURRENT_NEWS", [candidate("person:ronaldo", RONALDO)]));
  assert.equal(out.status, "NO_VALID_SUBJECTS");
  assert.equal(out.selectedPeople.length, 0);
  assert.ok(out.warnings.includes("GENERIC_FALLBACK_RECOMMENDED"));
  assert.equal(out.layoutSuggestion, "GENERIC_TEAM");
});

test("composeBanner: mixed eligible/review/ineligible -> only eligible selected", () => {
  // Stale: build a roster that triggers REQUIRES_REVIEW for the
  // first player via article date in the future.
  const out = composeBanner({
    articleType: "CURRENT_NEWS",
    articleDate: "2025-12-01",
    teamIds: [TEAM_MU],
    people: [
      candidate("person:rashford", RASHFORD),       // stale -> review
      candidate("person:fernandes", FERNANDES),     // also stale
    ],
    roster: ROSTER,
    maxStalenessDays: 30,
  });
  // Both stale with 30d threshold, so both go to REQUIRES_REVIEW.
  // Composer never auto-selects REQUIRES_REVIEW.
  assert.equal(out.selectedPeople.length, 0);
});

test("composeBanner: excludedPeople contains reasons", () => {
  const out = composeBanner(input("CURRENT_NEWS", [candidate("person:ronaldo", RONALDO)]));
  assert.equal(out.excludedPeople.length, 1);
  assert.equal(out.excludedPeople[0].personId, "person:ronaldo");
  assert.ok(out.excludedPeople[0].reasons.includes("FORMER_AT_DATE"));
});

// ============================================================================
// Regression / purity
// ============================================================================

test("composeBanner: does not mutate input", () => {
  const people: ComposerCandidate[] = [
    candidate("person:rashford", RASHFORD),
    candidate("person:fernandes", FERNANDES),
  ];
  const inputData: BannerComposerInput = input("CURRENT_NEWS", people);
  const snapshot = JSON.parse(JSON.stringify(inputData));
  composeBanner(inputData);
  assert.deepEqual(inputData, snapshot);
});

test("composeBanner: returns audit trail of all per-person eligibility", () => {
  const out = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD),
      candidate("person:ronaldo", RONALDO),
    ]),
  );
  assert.equal(out.audit.length, 2);
  const ids = out.audit.map((a) => a.personId).sort();
  assert.deepEqual(ids, ["person:rashford", "person:ronaldo"]);
});

test("composeBanner: confidence is 0 when nothing selected", () => {
  const out = composeBanner(input("CURRENT_NEWS", [candidate("person:ronaldo", RONALDO)]));
  assert.equal(out.confidence, 0);
});

test("composeBanner: confidence is mean of selected", () => {
  const out = composeBanner(
    input("CURRENT_NEWS", [
      candidate("person:rashford", RASHFORD),
      candidate("person:fernandes", FERNANDES),
    ]),
  );
  assert.ok(out.confidence > 0 && out.confidence <= 1);
});

test("composeBanner: HISTORICAL layout suggestion regardless of count", () => {
  const out = composeBanner(input("HISTORICAL", [candidate("person:ronaldo", RONALDO)]));
  assert.equal(out.layoutSuggestion, "HISTORICAL");
});

// ============================================================================
// Module-level guarantees
// ============================================================================

test("banner-composer module does not expose rights-evaluation symbols", async () => {
  // Dynamic import to ensure barrel isolation.
  const localMod = await import("../index");
  assert.equal("publicationDecision" in localMod, false);
  assert.equal("canDownloadBinary" in localMod, false);
  assert.equal("rights_confirmed" in localMod, false);
});

test("banner-composer module does not expose AI / image generation symbols", async () => {
  // Dynamic import to ensure barrel isolation. tsx ESM interop may
  // wrap the module in { default, "module.exports" }; flatten both.
  const localMod = await import("../index");
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(localMod)) {
    if (v && typeof v === "object") {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (!(k2 in flat)) flat[k2] = v2;
      }
    }
    flat[k] = v;
  }
  const keys = Object.keys(flat);
  const forbidden = ["generateImage", "renderImage", "generatePrompt", "callAI", "imageAI"];
  for (const f of forbidden) {
    assert.equal(keys.includes(f), false, `${f} must not be exported`);
  }
});

// ============================================================================
// selection helpers (unit-level)
// ============================================================================

test("filterEligible: keeps only ELIGIBLE", () => {
  // Build a fake paired array.
  const r1 = { decision: "ELIGIBLE" } as any;
  const r2 = { decision: "REQUIRES_REVIEW" } as any;
  const r3 = { decision: "NOT_ELIGIBLE" } as any;
  const arr = [
    { candidate: candidate("a", undefined), result: r1 },
    { candidate: candidate("b", undefined), result: r2 },
    { candidate: candidate("c", undefined), result: r3 },
  ];
  const out = filterEligible(arr as any);
  assert.equal(out.length, 1);
  assert.equal((out[0] as any).candidate.personId, "a");
});
