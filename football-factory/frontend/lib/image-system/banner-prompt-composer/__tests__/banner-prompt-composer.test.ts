// Football Factory — Banner Prompt Composer tests.
//
// Two test groups:
//   1. Pure `composeBannerPrompt` tests — mirror the external
//      Pack 2 behavior tests (p1..p24) to lock the public contract.
//   2. Hermes-owned `buildBannerPrompt` adapter tests — verify
//      the production Banner Composition -> prompt adapter:
//        a. Only reads `selectedPeople`, never `excludedPeople`.
//        b. Filters out REQUIRES_REVIEW / NOT_ELIGIBLE people
//           defensively (defense in depth on top of the
//           production composer).
//        c. Preserves visualContext verbatim.
//        d. NO_VALID_SUBJECTS -> non-person fallback.
//        e. NO network / NO rights calls.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { composeBannerPrompt, buildBannerPrompt, getStylePreset, getTemplateRule } from "../../banner-prompt-composer";
import { composeBanner } from "../../banner-composer/compose";
import type { PromptComposerInput, PromptSubject } from "../../banner-prompt-types";
import type {
  ComposerCandidate,
  BannerComposition,
} from "../../banner-composer/types";
import type { PersonTeamRelationship } from "../../entity-freshness/types";

const TEAM_MU = "team:manchester-united";
const TEAM_BARCELONA = "team:barcelona";

function playerSubject(
  personId: string,
  visualContext: PromptSubject["visualContext"],
  teamName?: string,
): PromptSubject {
  return {
    personId,
    displayName: personId.split(":")[1] ?? personId,
    role: "PLAYER",
    visualContext,
    teamName,
  };
}

function managerSubject(
  personId: string,
  visualContext: PromptSubject["visualContext"],
  teamName?: string,
): PromptSubject {
  return {
    personId,
    displayName: personId.split(":")[1] ?? personId,
    role: "MANAGER",
    visualContext,
    teamName,
  };
}

// ============================================================================
// Mirror Pack 2 behavior (p1..p24) against the production composer.
// ============================================================================

test("p1: HERO_BANNER + single CURRENT_CLUB player -> prompt mentions the player", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB", "Blue FC")],
      teamContext: ["Blue FC"],
    },
    { type: "HERO_BANNER", headline: "Big Match Tonight" },
  );
  assert.match(out.prompt, /saka/);
});

test("p2: NEWS_COVER + 2 people -> people.length == 2", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [
        managerSubject("person:emery", "CURRENT_CLUB", "Blue FC"),
        playerSubject("person:saka", "CURRENT_CLUB", "Blue FC"),
      ],
    },
    { type: "NEWS_COVER" },
  );
  assert.equal(out.people.length, 2);
});

test("p3: TRANSFER_NEWS + TARGET_CLUB + TRANSFER_PENDING -> DO_NOT_IMPLY_TRANSFER_COMPLETED", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:mbappe", "TARGET_CLUB", "Red FC")],
      transferStatus: "TRANSFER_PENDING",
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_TRANSFER_COMPLETED"));
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_TARGET_IS_CURRENT"));
});

test("p4: TRANSFER_NEWS + NEW_CLUB + TRANSFER_CONFIRMED + transferEffective=false -> DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:mbappe", "NEW_CLUB", "Red FC")],
      transferStatus: "TRANSFER_CONFIRMED",
      transferEffective: false,
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE"));
});

test("p5: TRANSFER_CONFIRMED + transferEffective=true -> NOT DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:mbappe", "NEW_CLUB", "Red FC")],
      transferStatus: "TRANSFER_CONFIRMED",
      transferEffective: true,
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.equal(
    out.visualWarnings.includes("DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE"),
    false,
  );
});

test("p6: HISTORICAL + HISTORICAL_SUBJECT -> stylePreset HISTORICAL_ARCHIVE", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [
        {
          personId: "person:legend",
          displayName: "Legend",
          role: "PLAYER",
          visualContext: "HISTORICAL_SUBJECT",
        },
      ],
    },
    { type: "HISTORICAL" },
  );
  assert.equal(out.stylePreset, "HISTORICAL_ARCHIVE");
});

test("p7: PROFILE + FORMER_CLUB -> aspectRatio 4:5", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:ronaldo", "FORMER_CLUB")],
    },
    { type: "PROFILE" },
  );
  assert.equal(out.aspectRatio, "4:5");
});

test("p8: NO_VALID_SUBJECTS + 0 people -> 0 people + NON_PERSON_FALLBACK", () => {
  const out = composeBannerPrompt(
    { status: "NO_VALID_SUBJECTS", people: [] },
    { type: "HERO_BANNER" },
  );
  assert.equal(out.people.length, 0);
  assert.ok(out.visualWarnings.includes("NON_PERSON_FALLBACK"));
});

test("p9: 4 people + HERO_BANNER -> clamped to 3 (maxPeople rule)", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [1, 2, 3, 4].map((i) =>
        playerSubject(`person:p${i}`, "CURRENT_CLUB", "Blue FC"),
      ),
    },
    { type: "HERO_BANNER" },
  );
  assert.equal(out.people.length, 3);
});

test("p10: PROFILE + 2 people -> 1 person (maxPeople=1 rule)", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [
        playerSubject("person:a", "CURRENT_CLUB"),
        playerSubject("person:b", "CURRENT_CLUB"),
      ],
    },
    { type: "PROFILE" },
  );
  assert.equal(out.people.length, 1);
});

test("p11: deterministic output for identical input", () => {
  const input: PromptComposerInput = {
    status: "READY",
    people: [playerSubject("person:saka", "CURRENT_CLUB", "Blue FC")],
  };
  assert.deepEqual(
    composeBannerPrompt(input, { type: "HERO_BANNER" }),
    composeBannerPrompt(input, { type: "HERO_BANNER" }),
  );
});

test("p12: empty teamContext -> prompt explicitly says 'no team context supplied'", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:x", "CURRENT_CLUB")],
      teamContext: [],
    },
    { type: "HERO_BANNER" },
  );
  assert.match(out.prompt, /no team context supplied/);
});

test("p13: ARTICLE_IMAGE -> no oversized headline", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB")],
    },
    { type: "ARTICLE_IMAGE", headline: "x" },
  );
  assert.match(out.prompt, /no oversized headline/);
});

test("p14: HERO_BANNER -> textSafeZone includes 'protected'", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB")],
    },
    { type: "HERO_BANNER" },
  );
  assert.match(out.textSafeZone, /protected/);
});

test("p15: HERO_BANNER -> prompt mentions 'central 70%' (mobile crop safety)", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB")],
    },
    { type: "HERO_BANNER" },
  );
  assert.match(out.prompt, /central 70%/);
});

test("p16: headline longer than 7 words -> truncated to 7 words", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB")],
    },
    {
      type: "HERO_BANNER",
      headline: "one two three four five six seven eight",
    },
  );
  assert.equal(out.prompt.includes("eight"), false);
  assert.match(out.prompt, /short headline metadata="one two three four five six seven"/);
});

test("p17: TARGET_CLUB + TRANSFER_NEWS -> at least one warning", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:mbappe", "TARGET_CLUB")],
      transferStatus: "TRANSFER_PENDING",
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.ok(out.visualWarnings.length > 0);
});

test("p18: PROFILE_SUBJECT visualContext -> preserved verbatim", () => {
  // PROFILE_SUBJECT is a valid output visualContext from the
  // production composer (for PROFILE articles). The composer
  // MUST preserve it verbatim without warnings.
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:x", "PROFILE_SUBJECT")],
    },
    { type: "PROFILE" },
  );
  assert.equal(out.people[0]?.visualContext, "PROFILE_SUBJECT");
  assert.equal(
    out.visualWarnings.includes("UNCERTAIN_VISUAL_CONTEXT"),
    false,
  );
});

test("p19: getStylePreset MATCHDAY -> competitive tone", () => {
  assert.equal(getStylePreset("MATCHDAY")?.tone, "competitive");
});

test("p20: getTemplateRule MATCH_NEWS -> aspectRatio 16:9", () => {
  assert.equal(getTemplateRule("MATCH_NEWS")?.aspectRatio, "16:9");
});

test("p21: BREAKING_NEWS -> stylePreset BREAKING_NEWS", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB")],
    },
    { type: "BREAKING_NEWS" },
  );
  assert.equal(out.stylePreset, "BREAKING_NEWS");
});

test("p22: ARTICLE_IMAGE -> stylePreset CLEAN_ARTICLE_EDITORIAL", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB")],
    },
    { type: "ARTICLE_IMAGE" },
  );
  assert.equal(out.stylePreset, "CLEAN_ARTICLE_EDITORIAL");
});

test("p23: unknown banner type -> throws UNSUPPORTED_BANNER_TYPE", () => {
  assert.throws(
    () =>
      composeBannerPrompt(
        { status: "READY", people: [] },
        { type: "BAD" as never },
      ),
    /UNSUPPORTED_BANNER_TYPE/,
  );
});

test("p24: TRANSFER_NEWS + maxPeople=2 -> people clamped to 2", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [
        playerSubject("p1", "CURRENT_CLUB"),
        playerSubject("p2", "CURRENT_CLUB"),
        playerSubject("p3", "CURRENT_CLUB"),
      ],
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.equal(out.people.length, 2);
});

// ============================================================================
// Required A13 explicit assertions (1..20).
// ============================================================================

test("A13.1 selectedPeople only — adapter does not read excludedPeople", () => {
  // Build a composition manually. The adapter must NEVER use
  // excludedPeople — we feed it a poisoned record with a
  // duplicated "ghost" person inside excludedPeople to verify.
  const composition: BannerComposition = {
    status: "READY",
    selectedPeople: [
      {
        personId: "person:good",
        displayName: "Good",
        role: "PLAYER",
        visualContext: "CURRENT_CLUB",
        articleDate: "2024-09-01",
      },
    ],
    excludedPeople: [
      {
        personId: "person:ghost",
        displayName: "Ghost",
        reasons: ["NOT_ELIGIBLE"],
      },
    ],
    teamIds: [TEAM_MU],
    competitionIds: [],
    layoutSuggestion: "SINGLE_SUBJECT",
    warnings: [],
    confidence: 1.0,
    audit: [
      {
        eligible: true,
        decision: "ELIGIBLE",
        personId: "person:good",
        teamId: TEAM_MU,
        role: "PLAYER",
        relationshipStatus: "ACTIVE",
        visualContext: "CURRENT_CLUB",
        reasons: ["ACTIVE_AT_DATE"],
        verifiedAt: "2024-08-25T00:00:00Z",
        confidence: 1.0,
      },
    ],
  };
  const out = buildBannerPrompt(composition, { type: "HERO_BANNER" });
  assert.equal(out.people.length, 1);
  assert.equal(out.people[0]?.personId, "person:good");
  assert.equal(
    out.people.some((p) => p.personId === "person:ghost"),
    false,
  );
});

test("A13.2 REQUIRES_REVIEW audit entry -> subject filtered out by adapter", () => {
  // selectedPeople contains the person, but the audit says
  // REQUIRES_REVIEW. Defense in depth: the adapter MUST drop it.
  const composition: BannerComposition = {
    status: "REQUIRES_REVIEW",
    selectedPeople: [
      {
        personId: "person:ambiguous",
        displayName: "Ambiguous",
        role: "PLAYER",
        visualContext: "CURRENT_CLUB",
        articleDate: "2024-09-01",
      },
    ],
    excludedPeople: [],
    teamIds: [TEAM_MU],
    competitionIds: [],
    layoutSuggestion: "SINGLE_SUBJECT",
    warnings: ["REQUIRES_REVIEW_INCLUDED"],
    confidence: 0.5,
    audit: [
      {
        eligible: false,
        decision: "REQUIRES_REVIEW",
        personId: "person:ambiguous",
        teamId: TEAM_MU,
        role: "PLAYER",
        relationshipStatus: "UNKNOWN",
        visualContext: "CURRENT_CLUB",
        reasons: ["PERSON_TEAM_UNKNOWN"],
        verifiedAt: "2024-08-25T00:00:00Z",
        confidence: 0.1,
      },
    ],
  };
  const out = buildBannerPrompt(composition, { type: "HERO_BANNER" });
  assert.equal(out.people.length, 0);
  assert.ok(out.visualWarnings.includes("NON_PERSON_FALLBACK"));
});

test("A13.3 NOT_ELIGIBLE audit entry -> subject filtered out by adapter", () => {
  const composition: BannerComposition = {
    status: "READY",
    selectedPeople: [
      {
        personId: "person:former",
        displayName: "Former",
        role: "PLAYER",
        visualContext: "FORMER_CLUB",
        articleDate: "2024-09-01",
      },
    ],
    excludedPeople: [],
    teamIds: [TEAM_MU],
    competitionIds: [],
    layoutSuggestion: "SINGLE_SUBJECT",
    warnings: [],
    confidence: 0.85,
    audit: [
      {
        eligible: false,
        decision: "NOT_ELIGIBLE",
        personId: "person:former",
        teamId: TEAM_MU,
        role: "PLAYER",
        relationshipStatus: "INACTIVE",
        visualContext: "FORMER_CLUB",
        reasons: ["FORMER_AT_DATE"],
        verifiedAt: "2024-08-25T00:00:00Z",
        confidence: 0.85,
      },
    ],
  };
  const out = buildBannerPrompt(composition, { type: "HERO_BANNER" });
  assert.equal(out.people.length, 0);
});

test("A13.4 max people <= 3 (production rule)", () => {
  const subjects = [1, 2, 3, 4, 5].map((i) =>
    playerSubject(`person:p${i}`, "CURRENT_CLUB", "Blue FC"),
  );
  const out = composeBannerPrompt(
    { status: "READY", people: subjects },
    { type: "HERO_BANNER" },
  );
  assert.ok(out.people.length <= 3);
});

test("A13.5 deterministic output (deep equal) for identical input", () => {
  const input: PromptComposerInput = {
    status: "READY",
    people: [
      playerSubject("person:a", "CURRENT_CLUB"),
      playerSubject("person:b", "NEW_CLUB"),
    ],
  };
  const a = composeBannerPrompt(input, { type: "MATCH_NEWS" });
  const b = composeBannerPrompt(input, { type: "MATCH_NEWS" });
  assert.deepEqual(a, b);
});

test("A13.6 no mutation of input people array", () => {
  const people: PromptSubject[] = [
    playerSubject("person:a", "CURRENT_CLUB", "Blue FC"),
    playerSubject("person:b", "CURRENT_CLUB", "Red FC"),
  ];
  const snapshot = JSON.parse(JSON.stringify(people));
  composeBannerPrompt({ status: "READY", people }, { type: "HERO_BANNER" });
  assert.deepEqual(people, snapshot);
});

test("A13.7 CURRENT_CLUB visualContext preserved verbatim", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:saka", "CURRENT_CLUB", "Blue FC")],
    },
    { type: "HERO_BANNER" },
  );
  assert.match(out.prompt, /visualContext=CURRENT_CLUB/);
  assert.equal(out.people[0]?.visualContext, "CURRENT_CLUB");
});

test("A13.8 NEW_CLUB visualContext preserved verbatim", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:mbappe", "NEW_CLUB", "Red FC")],
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.match(out.prompt, /visualContext=NEW_CLUB/);
  assert.equal(out.people[0]?.visualContext, "NEW_CLUB");
});

test("A13.9 FORMER_CLUB visualContext preserved + warning", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:ronaldo", "FORMER_CLUB", "Old FC")],
    },
    { type: "NEWS_COVER" },
  );
  assert.match(out.prompt, /visualContext=FORMER_CLUB/);
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_FORMER_IS_CURRENT"));
});

test("A13.10 TARGET_CLUB visualContext preserved + warning", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:mbappe", "TARGET_CLUB", "Red FC")],
      transferStatus: "TRANSFER_PENDING",
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.match(out.prompt, /visualContext=TARGET_CLUB/);
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_TARGET_IS_CURRENT"));
});

test("A13.11 TRANSFER_PENDING warning when status set", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:x", "CURRENT_CLUB")],
      transferStatus: "TRANSFER_PENDING",
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_TRANSFER_COMPLETED"));
});

test("A13.12 TRANSFER_CONFIRMED + !effective -> DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:x", "NEW_CLUB")],
      transferStatus: "TRANSFER_CONFIRMED",
      transferEffective: false,
    },
    { type: "TRANSFER_NEWS" },
  );
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE"));
});

test("A13.13 NO_VALID_SUBJECTS -> 0 people + non-person fallback", () => {
  const out = composeBannerPrompt(
    { status: "NO_VALID_SUBJECTS", people: [] },
    { type: "HERO_BANNER" },
  );
  assert.equal(out.people.length, 0);
  assert.ok(out.visualWarnings.includes("NON_PERSON_FALLBACK"));
  assert.match(out.prompt, /non-person sports editorial composition/);
});

test("A13.14 historical + former-person is allowed", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [playerSubject("person:legend", "HISTORICAL_SUBJECT")],
    },
    { type: "HISTORICAL" },
  );
  assert.equal(out.people.length, 1);
  assert.equal(out.stylePreset, "HISTORICAL_ARCHIVE");
});

test("A13.15 PROFILE max-person behavior -> 1", () => {
  const out = composeBannerPrompt(
    {
      status: "READY",
      people: [
        playerSubject("person:a", "CURRENT_CLUB"),
        playerSubject("person:b", "CURRENT_CLUB"),
        playerSubject("person:c", "CURRENT_CLUB"),
      ],
    },
    { type: "PROFILE" },
  );
  assert.equal(out.people.length, 1);
});

// ============================================================================
// Hermes adapter end-to-end via production Banner Composer.
// ============================================================================

function candidate(
  personId: string,
  relationship: PersonTeamRelationship | undefined,
  articleSubject = false,
): ComposerCandidate {
  return {
    personId,
    displayName: personId.split(":")[1],
    role: relationship?.role ?? "PLAYER",
    relationship,
    articleSubject,
  };
}

const VERIFIED_RECENT = "2024-08-25T00:00:00Z";
const VERIFIED_RECENT_2026 = "2026-08-25T00:00:00Z";

const CURRENT_PLAYER: PersonTeamRelationship = {
  personId: "person:saka",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "ACTIVE",
  validFrom: "2020-01-30",
  verifiedAt: VERIFIED_RECENT,
};

const FORMER_PLAYER: PersonTeamRelationship = {
  personId: "person:ronaldo",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "ACTIVE",
  validFrom: "2003-08-12",
  validTo: "2009-06-11",
  verifiedAt: VERIFIED_RECENT,
};

const TRANSFER_PENDING_PLAYER: PersonTeamRelationship = {
  personId: "person:mbappe",
  teamId: TEAM_MU,
  role: "PLAYER",
  status: "TRANSFER_PENDING",
  validFrom: "2025-07-01",
  verifiedAt: VERIFIED_RECENT,
};

const TRANSFER_CONFIRMED_AFTER_EFFECTIVE: PersonTeamRelationship = {
  personId: "person:saka-new",
  teamId: TEAM_BARCELONA,
  role: "PLAYER",
  status: "TRANSFER_CONFIRMED",
  validFrom: "2025-07-01",
  verifiedAt: VERIFIED_RECENT_2026,
};

const ROSTER_E2E = [
  CURRENT_PLAYER,
  FORMER_PLAYER,
  TRANSFER_PENDING_PLAYER,
  TRANSFER_CONFIRMED_AFTER_EFFECTIVE,
];

test("E2E.A: current player + CURRENT_NEWS -> prompt contains the player", () => {
  const composition = composeBanner({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    people: [candidate("person:saka", CURRENT_PLAYER, true)],
    roster: ROSTER_E2E,
  });
  const out = buildBannerPrompt(composition, { type: "HERO_BANNER" });
  assert.equal(out.people.length, 1);
  assert.equal(out.people[0]?.personId, "person:saka");
  assert.equal(out.people[0]?.visualContext, "CURRENT_CLUB");
});

test("E2E.B: former player + CURRENT_NEWS -> absent from prompt", () => {
  const composition = composeBanner({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    people: [candidate("person:ronaldo", FORMER_PLAYER, true)],
    roster: ROSTER_E2E,
  });
  const out = buildBannerPrompt(composition, { type: "HERO_BANNER" });
  assert.equal(out.people.length, 0);
  assert.ok(out.visualWarnings.includes("NON_PERSON_FALLBACK"));
});

test("E2E.C: TRANSFER_PENDING + CURRENT_NEWS + articleDate < validFrom -> visualContext CURRENT_CLUB preserved", () => {
  // Per the production truth table, TRANSFER_PENDING + CURRENT_NEWS
  // (focus team = the record's teamId) returns ELIGIBLE / CURRENT_CLUB
  // — the player is still officially at the club until the move
  // is confirmed. The Prompt Composer MUST preserve that
  // CURRENT_CLUB visualContext verbatim.
  const composition = composeBanner({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01", // before validFrom 2025-07-01
    teamIds: [TEAM_MU],
    people: [candidate("person:mbappe", TRANSFER_PENDING_PLAYER, true)],
    roster: ROSTER_E2E,
  });
  const out = buildBannerPrompt(composition, { type: "TRANSFER_NEWS" });
  assert.equal(out.people.length, 1);
  assert.equal(out.people[0]?.personId, "person:mbappe");
  assert.equal(out.people[0]?.visualContext, "CURRENT_CLUB");
  // The renderer must not imply the player has already moved.
  assert.ok(out.visualWarnings.includes("DO_NOT_IMPLY_TRANSFER_COMPLETED"));
});

test("E2E.D: TRANSFER_CONFIRMED after effective + CURRENT_NEWS -> visualContext NEW_CLUB preserved", () => {
  const composition = composeBanner({
    articleType: "CURRENT_NEWS",
    articleDate: "2026-09-01", // after validFrom 2025-07-01
    teamIds: [TEAM_BARCELONA],
    people: [
      candidate("person:saka-new", TRANSFER_CONFIRMED_AFTER_EFFECTIVE, true),
    ],
    roster: ROSTER_E2E,
  });
  const out = buildBannerPrompt(composition, { type: "HERO_BANNER" });
  assert.equal(out.people.length, 1);
  assert.equal(out.people[0]?.visualContext, "NEW_CLUB");
  // NO transfer-not-effective warning because the adapter derived
  // transferEffective=true from the production audit.
  assert.equal(
    out.visualWarnings.includes("DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE"),
    false,
  );
});

test("E2E.E: NO_VALID_SUBJECTS -> non-person prompt", () => {
  // Build a composition that the production composer will resolve
  // to NO_VALID_SUBJECTS by passing a candidate with no roster
  // record at all.
  const composition = composeBanner({
    articleType: "CURRENT_NEWS",
    articleDate: "2024-09-01",
    teamIds: [TEAM_MU],
    people: [candidate("person:ghost", undefined)],
    roster: ROSTER_E2E,
  });
  const out = buildBannerPrompt(composition, { type: "HERO_BANNER" });
  assert.equal(out.people.length, 0);
  assert.ok(out.visualWarnings.includes("NON_PERSON_FALLBACK"));
  assert.match(out.prompt, /non-person sports editorial composition/);
  assert.match(out.prompt, /do not inject famous players or managers/);
});

// ============================================================================
// Static guards — no network / no AI-image calls / no rights symbols.
// ============================================================================

test("static: composer source has no fetch / XHR / openai / image API", async () => {
  const src = await fs.readFile(
    path.resolve(
      __dirname,
      "..",
      "..",
      "banner-prompt-composer.ts",
    ),
    "utf8",
  );
  assert.equal(
    /\bfetch\s*\(|XMLHttpRequest|openai|stable[_-]?diffusion|midjourney|api-football|generateImage/i.test(
      src,
    ),
    false,
    "banner-prompt-composer.ts must not contain network/AI/image-API references",
  );
});

test("static: composer source has no rights-policy symbols", async () => {
  const src = await fs.readFile(
    path.resolve(
      __dirname,
      "..",
      "..",
      "banner-prompt-composer.ts",
    ),
    "utf8",
  );
  // Match code references (imports + function calls / type
  // references), not comments. Strip // and /* */ blocks first.
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    /publicationDecision|canDownloadBinary|rights_confirmed/i.test(codeOnly),
    false,
    "banner-prompt-composer.ts must not import or reference rights-policy symbols",
  );
});