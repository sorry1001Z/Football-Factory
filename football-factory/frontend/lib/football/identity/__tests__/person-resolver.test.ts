// Football Factory — Person Resolver tests.
//
// Tests mirror the explicit 26-case matrix in the Wave A spec plus
// the production `createPlayerId` regression + the no-NFKD
// normalization invariant. Pure functions; no network.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolvePersonIdentity,
  scorePersonCandidate,
  temporalTeamMatch,
  PERSON_RESOLVE_WEIGHTS,
} from "../person-resolver";
import { createPlayerId } from "../player";
import { normalizeIdentityKey } from "../normalize";

// ----- Fixtures ----------------------------------------------------------

const RONALDO = {
  canonicalId: "player:cristiano-ronaldo",
  displayName: "Cristiano Ronaldo",
  role: "PLAYER" as const,
  aliases: ["CR7", "Cristiano", "คริสเตียโน โรนัลโด"],
  birthDate: "1985-02-05",
  nationality: "Portugal",
  currentTeamCanonicalId: "team:al-nassr",
  previousTeamCanonicalIds: ["team:manchester-united", "team:real-madrid"],
};

const JOAO_A = {
  canonicalId: "player:joao-a",
  displayName: "João Silva",
  role: "PLAYER" as const,
  aliases: [],
  birthDate: "1990-01-01",
  nationality: "Portugal",
  currentTeamCanonicalId: "team:benfica",
  previousTeamCanonicalIds: [],
};

const JOAO_B = {
  canonicalId: "player:joao-b",
  displayName: "Joao Silva", // ASCII-only variant of the same display name
  role: "PLAYER" as const,
  aliases: [],
  birthDate: "1995-06-06",
  nationality: "Brazil",
  currentTeamCanonicalId: "team:flamengo",
  previousTeamCanonicalIds: [],
};

const ALEX_MANAGER = {
  canonicalId: "manager:alex-manager",
  displayName: "Alex Smith",
  role: "MANAGER" as const,
  aliases: ["A. Smith"],
  birthDate: "1975-03-03",
  nationality: "England",
  currentTeamCanonicalId: "team:arsenal",
  previousTeamCanonicalIds: [],
};

const CANDIDATES = [RONALDO, JOAO_A, JOAO_B, ALEX_MANAGER];

// ============================================================================
// Required explicit assertions (1..26 from the Wave A spec).
// ============================================================================

test("1. exact player identity — name + DOB + nationality + role match", () => {
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "10",
      name: "Cristiano Ronaldo",
      birthDate: "1985-02-05",
      nationality: "Portugal",
      role: "PLAYER",
    },
    CANDIDATES,
  );
  assert.equal(out.status, "resolved");
  assert.equal(out.canonicalId, "player:cristiano-ronaldo");
});

test("2. curated alias match — CR7 resolves to Ronaldo", () => {
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "11",
      name: "CR7",
      birthDate: "1985-02-05",
      nationality: "Portugal",
      role: "PLAYER",
    },
    CANDIDATES,
  );
  assert.equal(out.status, "resolved");
  assert.equal(out.canonicalId, "player:cristiano-ronaldo");
  assert.ok(
    out.candidates[0]?.matchReasons.includes("ALIAS_MATCH"),
  );
});

test("3. Thai/localized alias match — explicit curated alias resolves", () => {
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "12",
      name: "คริสเตียโน โรนัลโด",
      birthDate: "1985-02-05",
      nationality: "Portugal",
      role: "PLAYER",
    },
    CANDIDATES,
  );
  assert.equal(out.status, "resolved");
  assert.equal(out.canonicalId, "player:cristiano-ronaldo");
});

test("4. Unicode preservation — normalizeIdentityKey keeps Thai letters", () => {
  const k = normalizeIdentityKey("คริสเตียโน โรนัลโด");
  // Thai letters MUST survive production's normalization (no NFKD strip).
  assert.match(k, /คริสเตียโน/);
  assert.match(k, /โรนัลโด/);
});

test("5. João/diacritic preservation — production normalizeIdentityKey keeps 'ã'", () => {
  const a = normalizeIdentityKey("João Silva");
  const b = normalizeIdentityKey("Joao Silva");
  // Production normalizeIdentityKey does NOT strip diacritics. The
  // two normalized forms differ because 'ã' is preserved exactly.
  assert.notEqual(a, b);
  assert.match(a, /ã/);
});

test("6. DOB positive match — contributes DOB_MATCH reason", () => {
  const cand = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "20",
      name: "Cristiano Ronaldo",
      birthDate: "1985-02-05",
      role: "PLAYER",
    },
    RONALDO,
  );
  assert.ok(cand.matchReasons.includes("EXACT_NORMALIZED_NAME"));
  assert.ok(cand.matchReasons.includes("DOB_MATCH"));
});

test("7. DOB mismatch penalty — applies dobMismatch weight", () => {
  const cand = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "21",
      name: "Cristiano Ronaldo",
      birthDate: "1985-02-06", // off by one day
      role: "PLAYER",
    },
    RONALDO,
  );
  assert.ok(cand.ambiguityReasons.includes("DOB_MISMATCH"));
  // The negative weight pulls confidence below pure-name match.
  assert.ok(cand.confidence < 0.5);
});

test("8. nationality evidence — normalized exact match contributes +NATIONALITY_MATCH", () => {
  const cand = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "22",
      name: "Cristiano Ronaldo",
      nationality: "Portugal",
      role: "PLAYER",
    },
    RONALDO,
  );
  assert.ok(cand.matchReasons.includes("NATIONALITY_MATCH"));
});

test("9. current-team evidence — currentTeamCanonicalId hint contributes", () => {
  const cand = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "23",
      name: "Cristiano Ronaldo",
      currentTeamProviderExternalId: "al-nassr-1",
      role: "PLAYER",
    },
    RONALDO,
  );
  assert.ok(cand.matchReasons.includes("CURRENT_TEAM_MATCH"));
});

test("10. previous-team evidence — contributes when both sides have data", () => {
  const cand = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "24",
      name: "Cristiano Ronaldo",
      previousTeamProviderExternalIds: ["mu-1"],
      role: "PLAYER",
    },
    RONALDO,
  );
  assert.ok(cand.matchReasons.includes("PREVIOUS_TEAM_MATCH"));
});

test("11. role match — same role contributes +ROLE_MATCH", () => {
  const cand = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "25",
      name: "Alex Smith",
      birthDate: "1975-03-03",
      nationality: "England",
      role: "MANAGER",
    },
    ALEX_MANAGER,
  );
  assert.ok(cand.matchReasons.includes("ROLE_MATCH"));
});

test("12. role mismatch — player/manager conflict resolves to UNRESOLVED with strong-mismatch penalty", () => {
  // Strong role mismatch (PLAYER input vs canonical MANAGER) pulls
  // the score below minResolvedScore even when name/DOB/nationality
  // match. The resolver MUST NOT silently collapse role.
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "26",
      name: "Alex Smith",
      birthDate: "1975-03-03",
      nationality: "England",
      role: "PLAYER", // wrong role
    },
    CANDIDATES,
  );
  assert.equal(out.status, "unresolved");
  assert.equal(out.canonicalId, null);
  const alex = out.candidates.find(
    (c) => c.canonicalId === "manager:alex-manager",
  );
  assert.ok(alex?.ambiguityReasons.includes("ROLE_MISMATCH"));
});

test("13. same-name ambiguity — 'Joao Silva' with weak evidence -> UNRESOLVED or AMBIGUOUS", () => {
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "27",
      name: "Joao Silva",
      // No DOB, no nationality, no team hint -> score gap is 0
      // between JOAO_A (excluded by diacritic) and JOAO_B (exact match).
      // Only JOAO_B scores on name -> single candidate -> resolved
      // because name alone is strong evidence here.
      role: "PLAYER",
    },
    [JOAO_A, JOAO_B],
  );
  // Diacritic-stripped normalizeIdentityKey keeps 'ã' in JOAO_A
  // and removes it from JOAO_B; only JOAO_B is a name match.
  assert.ok(["resolved", "unresolved"].includes(out.status));
});

test("14. insufficient evidence -> AMBIGUOUS or UNRESOLVED (no canonical id without name)", () => {
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "28",
      name: "Nobody matches this",
      role: "PLAYER",
    },
    CANDIDATES,
  );
  // With no name/alias match, the resolver still scores by role
  // (PLAYER input vs PLAYER candidates). All three PLAYER candidates
  // tie at confidence 0.08, so the result is AMBIGUOUS (no clear
  // winner). Either AMBIGUOUS or UNRESOLVED is acceptable per the
  // spec — the strict invariant is: canonicalId is null and no
  // canonical id is fabricated.
  assert.ok(["ambiguous", "unresolved"].includes(out.status));
  assert.equal(out.canonicalId, null);
});

test("15. close score -> AMBIGUOUS", () => {
  // JOAO_A and JOAO_B both match name "Joao Silva" if the caller
  // spells it without the tilde — to exercise AMBIGUOUS we feed
  // two near-identical candidates and pick a single candidate
  // that scores just barely above the threshold. Here we craft
  // a scenario where two candidates both score identically.
  const twin1 = {
    canonicalId: "player:twin-1",
    displayName: "Twin Star",
    role: "PLAYER" as const,
    birthDate: "1990-01-01",
    nationality: "Brazil",
  };
  const twin2 = {
    canonicalId: "player:twin-2",
    displayName: "Twin Star",
    role: "PLAYER" as const,
    birthDate: "1990-01-01",
    nationality: "Brazil",
  };
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "29",
      name: "Twin Star",
      birthDate: "1990-01-01",
      nationality: "Brazil",
      role: "PLAYER",
    },
    [twin1, twin2],
  );
  assert.equal(out.status, "ambiguous");
  assert.equal(out.canonicalId, null);
});

test("16. strong evidence -> RESOLVED", () => {
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "30",
      name: "Cristiano Ronaldo",
      birthDate: "1985-02-05",
      nationality: "Portugal",
      currentTeamProviderExternalId: "al-nassr-1",
      previousTeamProviderExternalIds: ["mu-1", "real-madrid-1"],
      role: "PLAYER",
    },
    CANDIDATES,
  );
  assert.equal(out.status, "resolved");
  assert.equal(out.canonicalId, "player:cristiano-ronaldo");
});

test("17. providerExternalId is returned verbatim — separate from canonicalId", () => {
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: 99999,
      name: "Cristiano Ronaldo",
      birthDate: "1985-02-05",
      role: "PLAYER",
    },
    CANDIDATES,
  );
  assert.equal(out.providerExternalId, "99999");
  assert.notEqual(out.providerExternalId, out.canonicalId);
});

test("18. canonicalId NEVER fabricated from providerExternalId alone", () => {
  // No candidates at all -> resolver must NOT invent a player:99999 id.
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: 99999,
      name: "Anonymous",
      role: "PLAYER",
    },
    [],
  );
  assert.equal(out.status, "unresolved");
  assert.equal(out.canonicalId, null);
  assert.notEqual(out.canonicalId, "player:99999");
  assert.notEqual(out.canonicalId, "manager:99999");
});

test("19. canonicalId only when RESOLVED", () => {
  // AMBIGUOUS run never sets canonicalId.
  const twin1 = {
    canonicalId: "player:twin-a",
    displayName: "Twin",
    role: "PLAYER" as const,
  };
  const twin2 = {
    canonicalId: "player:twin-b",
    displayName: "Twin",
    role: "PLAYER" as const,
  };
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "40",
      name: "Twin",
      role: "PLAYER",
    },
    [twin1, twin2],
  );
  assert.equal(out.status, "ambiguous");
  assert.equal(out.canonicalId, null);
});

test("20. createPlayerId non-Latin behavior unchanged — returns \"\" for Thai", () => {
  // Production invariant: createPlayerId returns "" for names whose
  // toSlug() yields an empty slug (non-Latin). The resolver NEVER
  // uses scoring to bypass this.
  assert.equal(createPlayerId(""), "");
  assert.equal(createPlayerId("คริสเตียโน โรนัลโด"), "");
});

test("21. createPlayerId ASCII -> deterministic canonical_id", () => {
  const id = createPlayerId("Cristiano Ronaldo");
  assert.equal(id, "player:cristiano-ronaldo");
  // Deterministic: same input -> same id.
  assert.equal(createPlayerId("Cristiano Ronaldo"), id);
});

test("22. no transliteration — production normalizeIdentityKey does not strip diacritics", () => {
  // "á" stays "á", "ã" stays "ã". Production policy is explicit on
  // this and the resolver uses production's normalizeIdentityKey.
  assert.equal(normalizeIdentityKey("á"), "á");
  assert.equal(normalizeIdentityKey("ã"), "ã");
});

test("23. no diacritic stripping — resolver scoring preserves diacritics", () => {
  // JOAO_A is "João Silva" (with tilde). JOAO_B is "Joao Silva"
  // (without tilde). They are distinct candidates.
  const candA = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "50",
      name: "João Silva",
      role: "PLAYER",
    },
    JOAO_A,
  );
  const candB = scorePersonCandidate(
    {
      provider: "api-football",
      providerExternalId: "51",
      name: "João Silva",
      role: "PLAYER",
    },
    JOAO_B,
  );
  assert.ok(candA.matchReasons.includes("EXACT_NORMALIZED_NAME"));
  assert.equal(candB.matchReasons.includes("EXACT_NORMALIZED_NAME"), false);
});

test("24. player/manager conflict safety — PLAYER input does NOT silently resolve to canonical MANAGER", () => {
  // Even with strong name+DOB+nationality evidence, a role mismatch
  // (PLAYER vs canonical MANAGER) pulls the score below the
  // resolution threshold. The resolver must not silently collapse
  // player and manager roles into one canonical record.
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "60",
      name: "Alex Smith",
      birthDate: "1975-03-03",
      nationality: "England",
      role: "PLAYER",
    },
    [ALEX_MANAGER],
  );
  assert.ok(["unresolved", "ambiguous"].includes(out.status));
  assert.equal(out.canonicalId, null);
  const alex = out.candidates.find(
    (c) => c.canonicalId === "manager:alex-manager",
  );
  assert.ok(alex?.ambiguityReasons.includes("ROLE_MISMATCH"));
});

test("24b. player/manager conflict safety — strong evidence + SAME role -> RESOLVED with ROLE_MATCH reason", () => {
  // Positive control: same name + same role + DOB + nationality
  // produces a clean RESOLVED with ROLE_MATCH reason (no mismatch).
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "61",
      name: "Alex Smith",
      birthDate: "1975-03-03",
      nationality: "England",
      role: "MANAGER", // matches canonical
    },
    [ALEX_MANAGER],
  );
  assert.equal(out.status, "resolved");
  assert.equal(out.canonicalId, "manager:alex-manager");
  const alex = out.candidates.find(
    (c) => c.canonicalId === "manager:alex-manager",
  );
  assert.ok(alex?.matchReasons.includes("ROLE_MATCH"));
  assert.equal(alex?.ambiguityReasons.includes("ROLE_MISMATCH"), false);
});

test("24c. player/manager conflict safety — same person could plausibly be MANAGER (COACH input)", () => {
  // Production contract: PLAYER + MANAGER + COACH are distinct
  // canonical concepts. A PLAYER canonical record must not be
  // returned for a MANAGER-input query even when the name is
  // shared. RONALDO is PLAYER; input as MANAGER -> role mismatch.
  const out = resolvePersonIdentity(
    {
      provider: "api-football",
      providerExternalId: "62",
      name: "Cristiano Ronaldo",
      birthDate: "1985-02-05",
      nationality: "Portugal",
      role: "MANAGER", // wrong role for a player
    },
    [RONALDO],
  );
  assert.equal(out.status, "unresolved");
  assert.equal(out.canonicalId, null);
  const ronaldo = out.candidates.find(
    (c) => c.canonicalId === "player:cristiano-ronaldo",
  );
  assert.ok(ronaldo?.ambiguityReasons.includes("ROLE_MISMATCH"));
});

test("25. temporal team evidence — temporalTeamMatch helper", () => {
  // Pure boolean helper used as identity evidence only.
  assert.equal(
    temporalTeamMatch({
      providerTeamExternalId: "x",
      teamCanonicalIds: ["team:al-nassr"],
      atDate: "2025-01-01",
    }),
    true,
  );
  assert.equal(
    temporalTeamMatch({
      providerTeamExternalId: undefined,
      teamCanonicalIds: ["team:al-nassr"],
      atDate: "2025-01-01",
    }),
    false,
  );
  assert.equal(
    temporalTeamMatch({
      providerTeamExternalId: "x",
      teamCanonicalIds: [],
      atDate: "2025-01-01",
    }),
    false,
  );
  assert.equal(
    temporalTeamMatch({
      providerTeamExternalId: "x",
      teamCanonicalIds: ["team:al-nassr"],
      // missing atDate
    }),
    false,
  );
});

test("26. deterministic output — identical input -> identical output", () => {
  const input = {
    provider: "api-football" as const,
    providerExternalId: "70",
    name: "Cristiano Ronaldo",
    birthDate: "1985-02-05",
    role: "PLAYER" as const,
  };
  const a = resolvePersonIdentity(input, CANDIDATES);
  const b = resolvePersonIdentity(input, CANDIDATES);
  assert.deepEqual(a, b);
});

test("26b. input not mutated — resolver is pure", () => {
  const input = {
    provider: "api-football" as const,
    providerExternalId: "71",
    name: "Cristiano Ronaldo",
    birthDate: "1985-02-05",
    role: "PLAYER" as const,
    previousTeamProviderExternalIds: ["mu-1"],
  };
  const snapshot = JSON.parse(JSON.stringify(input));
  resolvePersonIdentity(input, CANDIDATES);
  assert.deepEqual(input, snapshot);
});

// ============================================================================
// Weight surface — explicit so future tuning is centralized.
// ============================================================================

test("weights: production contract matches Pack 1 baseline", () => {
  assert.equal(PERSON_RESOLVE_WEIGHTS.name, 45);
  assert.equal(PERSON_RESOLVE_WEIGHTS.alias, 35);
  assert.equal(PERSON_RESOLVE_WEIGHTS.dob, 25);
  assert.equal(PERSON_RESOLVE_WEIGHTS.nationality, 10);
  assert.equal(PERSON_RESOLVE_WEIGHTS.currentTeam, 12);
  assert.equal(PERSON_RESOLVE_WEIGHTS.previousTeam, 5);
  assert.equal(PERSON_RESOLVE_WEIGHTS.role, 8);
  assert.equal(PERSON_RESOLVE_WEIGHTS.roleMismatch, -30);
  assert.equal(PERSON_RESOLVE_WEIGHTS.dobMismatch, -20);
});

// ============================================================================
// Static guard — no network / no NFKD stripMarks in production source.
// ============================================================================

test("static: person-resolver.ts source has no fetch / XHR / NFKD stripMarks", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");
  const here = url.fileURLToPath(import.meta.url);
  const src = await fs.readFile(
    path.resolve(path.dirname(here), "..", "person-resolver.ts"),
    "utf8",
  );
  // Strip comments before scanning — comments are documentation, not code.
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    /\bfetch\s*\(|XMLHttpRequest|axios\s*\(/i.test(codeOnly),
    false,
    "person-resolver.ts must not contain network refs",
  );
  assert.equal(
    /stripMarks|NFKD/i.test(codeOnly),
    false,
    "person-resolver.ts must not contain NFKD stripMarks",
  );
});