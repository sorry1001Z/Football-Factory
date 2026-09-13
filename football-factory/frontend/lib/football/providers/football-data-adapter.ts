// Football Factory — football-data adapter (Wave B).
//
// Pure fixture-mode normalizer for the API-Football (api-sports) data
// shape. Mirrors the audited Pack 2 `FixtureApiFootballProvider` surface
// but adapted to production TypeScript shapes + production invariants.
//
// Production invariants enforced here:
//   - `providerExternalId` ALWAYS separate from `canonicalId`
//   - canonical_id is NULL unless an explicit identity resolver maps
//     `provider:<type>:<externalId>` to a canonical_id (no auto-fabrication)
//   - missing transfer date -> status UNKNOWN (no fabricated effective date)
//   - loan -> LOAN, free -> FREE_AGENT (semantics preserved)
//   - missing manager tenure -> validFrom/validTo null (no fabrication)
//   - future transfers: consumer must apply date-window checks
//   - missing fixture / injury / lineup data -> null / 'UNKNOWN' (no fabrication)
//
// Sits behind production `FootballService` (no direct network call here
// — the fixture is the only input). When the live transport slice ships,
// it wires through existing `lib/football/providers/api-football.client.ts`
// and `football-data.client.ts`. This module NEVER calls fetch.

import type { ProviderName } from "../types";

// ----- Output shapes (production-typed) ---------------------------------

export type RelationshipStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "TRANSFER_PENDING"
  | "TRANSFER_CONFIRMED"
  | "LOAN"
  | "FREE_AGENT"
  | "UNKNOWN";

export interface ApiFootballProviderEntity {
  /** NULL unless explicitly mapped by an identity resolver. */
  canonicalId: string | null;
  /** Provider's external id (string or number; normalized to string). */
  providerExternalId: string;
  /** Provider name. Always "api-football" for this adapter. */
  provider: ProviderName;
  /** Provider-observed display name (unverified — DO NOT use as canonical). */
  name: string;
  /** Optional extra metadata. */
  birthDate?: string;
  nationality?: string | null;
  position?: string | null;
  country?: string | null;
}

export interface NormalizedTransfer {
  person: ApiFootballProviderEntity;
  fromTeam: ApiFootballProviderEntity | null;
  team: ApiFootballProviderEntity | null;
  /** RelationshipStatus — UNKNOWN when transfer date missing. */
  status: RelationshipStatus;
  /** ISO date (YYYY-MM-DD) — null when unparseable. */
  validFrom: string | null;
  /** ISO date (YYYY-MM-DD) — null when ongoing / unparseable. Manager tenures only. */
  validTo?: string | null;
  source: ProviderName;
  /** ISO timestamp at normalization. */
  verifiedAt: string;
  /** True when the transfer's validFrom is on or before atDate. */
  effective?: boolean;
}

export interface NormalizedManagerRelationship extends NormalizedTransfer {
  /** Manager relationships always carry validTo (tenure end or null for ongoing). */
  validTo: string | null;
}

export interface NormalizedSquadEntry {
  player: ApiFootballProviderEntity;
  team: ApiFootballProviderEntity;
  status: RelationshipStatus;
}

export interface NormalizedCoachCareerStint {
  team: ApiFootballProviderEntity;
  /** ISO date (YYYY-MM-DD) — null when unparseable. */
  validFrom: string | null;
  /** ISO date (YYYY-MM-DD) — null when ongoing / unparseable. */
  validTo: string | null;
}

export interface NormalizedCoach {
  person: ApiFootballProviderEntity;
  career: NormalizedCoachCareerStint[];
}

export interface NormalizedFixture {
  providerExternalId: string;
  date: string | null;
  status: string;
  home: ApiFootballProviderEntity;
  away: ApiFootballProviderEntity;
  competition: ApiFootballProviderEntity;
  goals: { home: number | null; away: number | null };
}

export interface NormalizedStanding {
  competition: ApiFootballProviderEntity;
  rank: number;
  team: ApiFootballProviderEntity;
  points: number | null;
  played: number | null;
  goalDiff: number | null;
}

export interface NormalizedInjury {
  player: ApiFootballProviderEntity;
  team: ApiFootballProviderEntity;
  /** Free-text injury type as observed by provider (e.g. "Knock"). */
  type: string;
  /** Free-text reason. NO inferred severity / NO inferred recovery date. */
  reason: string | null;
  /** Provider's external fixture id when the injury is match-related. */
  fixtureExternalId: string | null;
}

export interface NormalizedLineupPlayer {
  player: ApiFootballProviderEntity;
  number: number | null;
  position: string | null;
}

export interface NormalizedLineup {
  team: ApiFootballProviderEntity;
  formation: string | null;
  coach: ApiFootballProviderEntity | null;
  startXI: NormalizedLineupPlayer[];
  substitutes: NormalizedLineupPlayer[];
}

// ----- Identity resolver boundary ---------------------------------------

/**
 * Identity resolver contract. Implementations MUST return `null`
 * unless an explicit canonical-id mapping exists for the supplied
 * `provider:type:externalId` key.
 *
 * Production ships with a `NullIdentityResolver` (returns null for
 * everything); the live transport slice will later inject an
 * explicit mapping resolver backed by the Wave A identity layer.
 */
export interface IdentityResolver {
  resolve(
    provider: ProviderName,
    type: "player" | "manager" | "team" | "competition",
    externalId: string | number,
  ): string | null;
}

export class NullIdentityResolver implements IdentityResolver {
  resolve(): string | null {
    return null;
  }
}

// ----- Fixture-mode provider -------------------------------------------

const PROVIDER: ProviderName = "api-football";

/**
 * Adapter that normalizes a fixture-mode API-Football payload into
 * production-typed records. Pure. No I/O. No env reads. No network.
 *
 * Usage:
 *   const adapter = new FootballDataAdapter(fixturePayload);
 *   adapter.getPlayers();
 *   adapter.getCoaches();
 *   adapter.getTransfers();
 *   adapter.getInjuries();
 *   adapter.getLineups();
 *   adapter.planRequestBudget({ dailyBudget: 100, teamCount: 20, matchCount: 10 });
 */
export class FootballDataAdapter {
  private readonly data: Record<string, unknown>;
  private readonly resolver: IdentityResolver;
  private readonly provider: ProviderName = PROVIDER;

  constructor(
    data: Record<string, unknown> = {},
    resolver: IdentityResolver = new NullIdentityResolver(),
  ) {
    this.data = data ?? {};
    this.resolver = resolver;
  }

  /** Internal: build a ProviderEntity with providerExternalId + canonicalId. */
  private entity(
    type: "player" | "manager" | "team" | "competition",
    id: unknown,
    name: string,
    extra: Record<string, unknown> = {},
  ): ApiFootballProviderEntity {
    const providerExternalId = id == null ? "" : String(id);
    return {
      canonicalId: this.resolver.resolve(this.provider, type, providerExternalId),
      providerExternalId,
      provider: this.provider,
      name: name ?? "",
      ...extra,
    };
  }

  /** ISO date (YYYY-MM-DD) — null when unparseable. NO fabricated dates. */
  private static iso(v: unknown): string | null {
    if (!v) return null;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  /** Teams. */
  getTeams(): ApiFootballProviderEntity[] {
    const teams = Array.isArray(this.data.teams) ? (this.data.teams as unknown[]) : [];
    return teams
      .map((t) => {
        const obj = (t ?? {}) as { team?: { id?: number; name?: string; country?: string } };
        const team = obj.team;
        if (!team) return null;
        return this.entity("team", team.id, team.name ?? "", {
          country: team.country ?? null,
        });
      })
      .filter((x): x is ApiFootballProviderEntity => x !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Squad for one team. */
  getSquad(teamId: string | number): NormalizedSquadEntry[] {
    const squads = Array.isArray(this.data.squads) ? (this.data.squads as unknown[]) : [];
    const found = squads.find(
      (s) => {
        const obj = s as { team?: { id?: number | string } };
        return obj.team && String(obj.team.id) === String(teamId);
      },
    );
    if (!found) return [];
    const obj = found as {
      team?: { id?: number; name?: string };
      players?: Array<{ id?: number; name?: string; position?: string }>;
    };
    const teamEntity = this.entity("team", obj.team?.id, obj.team?.name ?? "");
    const players = Array.isArray(obj.players) ? obj.players : [];
    return players.map((p) => ({
      player: this.entity("player", p.id, p.name ?? "", {
        position: p.position ?? null,
      }),
      team: teamEntity,
      status: "ACTIVE",
    }));
  }

  /** Players. */
  getPlayers(): ApiFootballProviderEntity[] {
    const players = Array.isArray(this.data.players) ? (this.data.players as unknown[]) : [];
    return players.map((p) => {
      const obj = p as {
        player?: {
          id?: number;
          name?: string;
          birth?: { date?: string };
          nationality?: string;
        };
        statistics?: Array<{ games?: { position?: string } }>;
      };
      const pl = obj.player;
      return this.entity("player", pl?.id, pl?.name ?? "", {
        birthDate: FootballDataAdapter.iso(pl?.birth?.date) ?? undefined,
        nationality: pl?.nationality ?? null,
        position: obj.statistics?.[0]?.games?.position ?? null,
      });
    });
  }

  /** Coaches (managers). */
  getCoaches(): NormalizedCoach[] {
    const coaches = Array.isArray(this.data.coaches) ? (this.data.coaches as unknown[]) : [];
    return coaches.map((c) => {
      const obj = c as {
        id?: number;
        name?: string;
        career?: Array<{
          team?: { id?: number; name?: string };
          start?: string;
          end?: string | null;
        }>;
      };
      const person = this.entity("manager", obj.id, obj.name ?? "");
      const career: NormalizedCoachCareerStint[] = Array.isArray(obj.career)
        ? obj.career.map((h) => ({
            team: this.entity("team", h.team?.id, h.team?.name ?? ""),
            validFrom: FootballDataAdapter.iso(h.start),
            validTo: FootballDataAdapter.iso(h.end),
          }))
        : [];
      return { person, career };
    });
  }

  /**
   * Transfers. Loan -> LOAN; Free -> FREE_AGENT; missing date ->
   * UNKNOWN; otherwise TRANSFER_CONFIRMED with validFrom only (the
   * consumer / entity-freshness gate decides effective vs future).
   */
  getTransfers(): NormalizedTransfer[] {
    const transfers = Array.isArray(this.data.transfers) ? (this.data.transfers as unknown[]) : [];
    return transfers.map((t) => {
      const obj = t as {
        player?: { id?: number; name?: string };
        date?: string;
        type?: string;
        teams?: {
          out?: { id?: number; name?: string } | null;
          in?: { id?: number; name?: string } | null;
        };
      };
      const d = FootballDataAdapter.iso(obj.date);
      const ty = String(obj.type ?? "").toLowerCase();
      let status: RelationshipStatus = "TRANSFER_CONFIRMED";
      if (ty === "loan") status = "LOAN";
      else if (ty === "free") status = "FREE_AGENT";
      else if (!d) status = "UNKNOWN";
      return {
        person: this.entity("player", obj.player?.id, obj.player?.name ?? ""),
        fromTeam: obj.teams?.out
          ? this.entity("team", obj.teams.out.id, obj.teams.out.name ?? "")
          : null,
        team: obj.teams?.in
          ? this.entity("team", obj.teams.in.id, obj.teams.in.name ?? "")
          : null,
        status,
        validFrom: d,
        source: this.provider,
        verifiedAt: new Date().toISOString(),
      };
    });
  }

  /** Fixtures. Missing fields stay null / 'UNKNOWN'. */
  getFixtures(): NormalizedFixture[] {
    const fixtures = Array.isArray(this.data.fixtures) ? (this.data.fixtures as unknown[]) : [];
    return fixtures.map((f) => {
      const obj = f as {
        fixture?: { id?: number; date?: string; status?: { short?: string } };
        league?: { id?: number; name?: string };
        teams?: {
          home?: { id?: number; name?: string };
          away?: { id?: number; name?: string };
        };
        goals?: { home?: number | null; away?: number | null };
      };
      const fx = obj.fixture ?? {};
      return {
        providerExternalId: fx.id == null ? "" : String(fx.id),
        date: fx.date ?? null,
        status: fx.status?.short ?? "UNKNOWN",
        home: this.entity("team", obj.teams?.home?.id, obj.teams?.home?.name ?? ""),
        away: this.entity("team", obj.teams?.away?.id, obj.teams?.away?.name ?? ""),
        competition: this.entity("competition", obj.league?.id, obj.league?.name ?? ""),
        goals: {
          home: obj.goals?.home ?? null,
          away: obj.goals?.away ?? null,
        },
      };
    });
  }

  /** Standings. */
  getStandings(): NormalizedStanding[] {
    const standings = Array.isArray(this.data.standings) ? (this.data.standings as unknown[]) : [];
    const out: NormalizedStanding[] = [];
    for (const block of standings) {
      const b = block as {
        league?: { id?: number; name?: string; standings?: unknown[][] };
      };
      const league = b.league;
      const tabs = Array.isArray(league?.standings) ? league.standings : [];
      const comp = this.entity("competition", league?.id, league?.name ?? "");
      for (const tab of tabs) {
        for (const row of tab) {
          const r = row as {
            rank?: number;
            team?: { id?: number; name?: string };
            points?: number;
            all?: { played?: number };
            goalsDiff?: number;
          };
          out.push({
            competition: comp,
            rank: r.rank ?? 0,
            team: this.entity("team", r.team?.id, r.team?.name ?? ""),
            points: r.points ?? null,
            played: r.all?.played ?? null,
            goalDiff: r.goalsDiff ?? null,
          });
        }
      }
    }
    return out.sort((a, b) => a.rank - b.rank);
  }

  /**
   * Injuries. Provider data preserved VERBATIM — no inferred severity,
   * no inferred recovery date, no fabricated fixture linkage.
   */
  getInjuries(): NormalizedInjury[] {
    const injuries = Array.isArray(this.data.injuries) ? (this.data.injuries as unknown[]) : [];
    return injuries.map((x) => {
      const obj = x as {
        player?: { id?: number; name?: string; type?: string; reason?: string };
        team?: { id?: number; name?: string };
        type?: string;
        reason?: string;
        fixture?: { id?: number };
      };
      const playerObj = obj.player ?? {};
      return {
        player: this.entity("player", playerObj.id, playerObj.name ?? ""),
        team: this.entity("team", obj.team?.id, obj.team?.name ?? ""),
        // Prefer player.type when present (API-Football nested under player).
        type: playerObj.type ?? obj.type ?? "UNKNOWN",
        reason: playerObj.reason ?? obj.reason ?? null,
        fixtureExternalId: obj.fixture?.id == null ? null : String(obj.fixture.id),
      };
    });
  }

  /**
   * Lineups. Only include members supplied by the provider — no
   * inference, no prediction. Formation + coach + startXI + substitutes
   * are passed through verbatim.
   */
  getLineups(): NormalizedLineup[] {
    const lineups = Array.isArray(this.data.lineups) ? (this.data.lineups as unknown[]) : [];
    return lineups.map((x) => {
      const obj = x as {
        team?: { id?: number; name?: string };
        formation?: string;
        coach?: { id?: number; name?: string };
        startXI?: Array<{ player?: { id?: number; name?: string; number?: number; pos?: string } }>;
        substitutes?: Array<{ player?: { id?: number; name?: string; number?: number; pos?: string } }>;
      };
      return {
        team: this.entity("team", obj.team?.id, obj.team?.name ?? ""),
        formation: obj.formation ?? null,
        coach: obj.coach
          ? this.entity("manager", obj.coach.id, obj.coach.name ?? "")
          : null,
        startXI: Array.isArray(obj.startXI)
          ? obj.startXI.map((y) => ({
              player: this.entity("player", y.player?.id, y.player?.name ?? "", {
                number: y.player?.number ?? null,
                position: y.player?.pos ?? null,
              }),
              number: y.player?.number ?? null,
              position: y.player?.pos ?? null,
            }))
          : [],
        substitutes: Array.isArray(obj.substitutes)
          ? obj.substitutes.map((y) => ({
              player: this.entity("player", y.player?.id, y.player?.name ?? "", {
                number: y.player?.number ?? null,
                position: y.player?.pos ?? null,
              }),
              number: y.player?.number ?? null,
              position: y.player?.pos ?? null,
            }))
          : [],
      };
    });
  }

  /**
   * Player-team relationship at a given date.
   * Mirrors production `entity-freshness` semantics:
   *   - LOAN / FREE_AGENT returned with their effective status
   *   - TRANSFER_CONFIRMED with validFrom > atDate -> TRANSFER_CONFIRMED + effective:false
   *   - TRANSFER_CONFIRMED with validFrom <= atDate -> ACTIVE + effective:true
   *   - missing validFrom -> UNKNOWN
   *   - squad membership fallback -> ACTIVE
   *   - no record -> UNKNOWN
   */
  getPlayerTeamRelationship(
    playerId: string | number,
    atDate = "9999-12-31",
  ): NormalizedTransfer & { effective?: boolean } {
    const transfers = this.getTransfers()
      .filter((x) => x.person.providerExternalId === String(playerId))
      .sort((a, b) => String(b.validFrom ?? "").localeCompare(String(a.validFrom ?? "")));
    const t = transfers[0];
    if (t) {
      if (!t.validFrom) {
        return { ...t, status: "UNKNOWN", effective: false };
      }
      if (t.status === "LOAN" || t.status === "FREE_AGENT") {
        return { ...t, effective: true };
      }
      if (t.validFrom > atDate) {
        return { ...t, status: "TRANSFER_CONFIRMED", effective: false };
      }
      return { ...t, status: "ACTIVE", effective: true };
    }
    // Squad membership fallback.
    const squads = Array.isArray(this.data.squads) ? (this.data.squads as unknown[]) : [];
    const squad = squads.find(
      (s) => {
        const obj = s as { players?: Array<{ id?: number | string }> };
        return obj.players?.some((p) => String(p.id) === String(playerId));
      },
    );
    const players = Array.isArray(this.data.players) ? (this.data.players as unknown[]) : [];
    const raw = players.find((p) => {
      const obj = p as { player?: { id?: number } };
      return String(obj.player?.id) === String(playerId);
    });
    const personObj = (raw ?? {}) as { player?: { name?: string } };
    const squadObj = (squad ?? {}) as { team?: { id?: number; name?: string } };
    return {
      person: this.entity("player", playerId, personObj.player?.name ?? "Unknown"),
      fromTeam: null,
      team: squadObj.team
        ? this.entity("team", squadObj.team.id, squadObj.team.name ?? "")
        : null,
      status: squadObj.team ? "ACTIVE" : "UNKNOWN",
      validFrom: null,
      source: this.provider,
      verifiedAt: new Date().toISOString(),
      effective: squadObj.team ? true : false,
    };
  }

  /**
   * Manager-team relationship at a given date. Returns ACTIVE when
   * the manager has a current stint covering atDate; INACTIVE when
   * the manager's most recent stint has ended; UNKNOWN when the
   * manager is not in the fixture data.
   */
  getManagerTeamRelationship(
    managerId: string | number,
    atDate = "9999-12-31",
  ): NormalizedManagerRelationship | null {
    const coaches = Array.isArray(this.data.coaches) ? (this.data.coaches as unknown[]) : [];
    const c = coaches.find((x) => {
      const obj = x as { id?: number };
      return String(obj.id) === String(managerId);
    });
    if (!c) {
      return {
        person: this.entity("manager", managerId, "Unknown"),
        fromTeam: null,
        team: null,
        status: "UNKNOWN",
        validFrom: null,
        validTo: null,
        source: this.provider,
        verifiedAt: new Date().toISOString(),
        effective: false,
      };
    }
    const obj = c as {
      id?: number;
      name?: string;
      career?: Array<{ team?: { id?: number; name?: string }; start?: string; end?: string }>;
    };
    const career = Array.isArray(obj.career) ? obj.career : [];
    const sorted = [...career].sort((a, b) =>
      String(b.start ?? "").localeCompare(String(a.start ?? "")),
    );
    const current = sorted.find(
      (h) =>
        (!h.start || String(h.start) <= atDate) &&
        (!h.end || String(h.end) >= atDate),
    );
    const latest = current ?? sorted[0];
    return {
      person: this.entity("manager", obj.id, obj.name ?? ""),
      fromTeam: null,
      team: latest?.team
        ? this.entity("team", latest.team.id, latest.team.name ?? "")
        : null,
      status: current ? "ACTIVE" : "INACTIVE",
      validFrom: FootballDataAdapter.iso(latest?.start),
      validTo: FootballDataAdapter.iso(latest?.end),
      source: this.provider,
      verifiedAt: new Date().toISOString(),
      effective: current ? true : false,
    };
  }

  /**
   * Team roster at a given date. Returns the per-player
   * relationship record for each player in the team squad.
   */
  getTeamRosterAtDate(
    teamId: string | number,
    atDate = "9999-12-31",
  ): NormalizedTransfer[] {
    return this.getSquad(teamId)
      .map((x) => this.getPlayerTeamRelationship(x.player.providerExternalId, atDate))
      .filter((r) => r.team && String(r.team.providerExternalId) === String(teamId));
  }

  /**
   * Current manager for a team at a given date. Returns the manager
   * with status === "ACTIVE" and a matching team, or null.
   */
  getCurrentManager(
    teamId: string | number,
    atDate = "9999-12-31",
  ): ReturnType<FootballDataAdapter["getManagerTeamRelationship"]> {
    const coaches = this.getCoaches();
    for (const c of coaches) {
      const m = this.getManagerTeamRelationship(c.person.providerExternalId, atDate);
      if (
        m &&
        m.status === "ACTIVE" &&
        m.team &&
        String(m.team.providerExternalId) === String(teamId)
      ) {
        return m;
      }
    }
    return null;
  }

  /**
   * Career history for one person (player transfers or manager
   * career). Type defaults to 'player'.
   */
  getPersonHistory(
    personId: string | number,
    type: "player" | "manager" = "player",
  ): NormalizedTransfer[] {
    if (type === "manager") {
      const m = this.getManagerTeamRelationship(personId, "9999-12-31");
      if (!m) return [];
      const coaches = Array.isArray(this.data.coaches) ? (this.data.coaches as unknown[]) : [];
      const coach = coaches.find((x) => {
        const obj = x as { id?: number };
        return String(obj.id) === String(personId);
      });
      if (!coach) return [];
      const obj = coach as {
        career?: Array<{ team?: { id?: number; name?: string }; start?: string; end?: string }>;
      };
      const career = Array.isArray(obj.career) ? obj.career : [];
      return career.map((h) => ({
        person: m.person,
        fromTeam: null,
        team: h.team ? this.entity("team", h.team.id, h.team.name ?? "") : null,
        status: h.end ? "INACTIVE" : "ACTIVE",
        validFrom: FootballDataAdapter.iso(h.start),
        validTo: FootballDataAdapter.iso(h.end),
        source: this.provider,
        verifiedAt: new Date().toISOString(),
      }));
    }
    return this.getTransfers().filter(
      (x) => x.person.providerExternalId === String(personId),
    );
  }
}

// ----- Cache policy + request-budget planner ----------------------------

/**
 * Per-endpoint TTL + priority. Values mirror the audited Pack 2
 * baseline. Tunable at the call-site if/when a real scheduler is
 * introduced.
 */
export const ProviderCachePolicy: Readonly<Record<
  string,
  { cacheTTL: number; priority: "LOW" | "MEDIUM" | "HIGH" }
>> = Object.freeze({
  teams: { cacheTTL: 86400, priority: "LOW" },
  squads: { cacheTTL: 43200, priority: "MEDIUM" },
  coaches: { cacheTTL: 43200, priority: "MEDIUM" },
  transfers: { cacheTTL: 3600, priority: "HIGH" },
  fixtures: { cacheTTL: 900, priority: "HIGH" },
  standings: { cacheTTL: 1800, priority: "MEDIUM" },
  injuries: { cacheTTL: 1800, priority: "HIGH" },
  lineups: { cacheTTL: 600, priority: "HIGH" },
});

export interface RequestBudgetPlanEntry {
  name: string;
  requestsPerDay: number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  refreshIntervalHours: number;
  cacheTTL: number;
  deferIfBudgetExceeded: boolean;
}

export interface RequestBudget {
  dailyBudget: number;
  requestsPerDay: number;
  remaining: number;
  withinBudget: boolean;
  plan: RequestBudgetPlanEntry[];
}

export interface PlanRequestBudgetOptions {
  dailyBudget?: number;
  teamCount?: number;
  matchCount?: number;
  transferWindow?: boolean;
}

/**
 * Plan a per-endpoint request schedule within a daily budget.
 *
 * Conservative ordering:
 *   1. lineups (highest priority, smallest TTL, near kickoff)
 *   2. fixtures
 *   3. injuries
 *   4. transfers (more during transfer windows)
 *   5. standings
 *   6. squads
 *   7. coaches
 *   8. teams
 *
 * Endpoints whose cumulative cost would exceed `dailyBudget` are
 * flagged `deferIfBudgetExceeded: true` and skipped. The plan is
 * deterministic.
 */
export function planRequestBudget(
  options: PlanRequestBudgetOptions = {},
): RequestBudget {
  const dailyBudget = options.dailyBudget ?? 100;
  const teamCount = options.teamCount ?? 20;
  const matchCount = options.matchCount ?? 10;
  const transferWindow = options.transferWindow ?? false;

  const order: Array<[string, number, "LOW" | "MEDIUM" | "HIGH"]> = [
    ["lineups", Math.max(1, Math.ceil(matchCount / 4)), "HIGH"],
    ["fixtures", 4, "HIGH"],
    ["injuries", Math.max(1, Math.ceil(matchCount / 5)), "HIGH"],
    ["transfers", transferWindow ? 8 : 2, "HIGH"],
    ["standings", 2, "MEDIUM"],
    ["squads", Math.ceil(teamCount / 10), "MEDIUM"],
    ["coaches", Math.ceil(teamCount / 10), "MEDIUM"],
    ["teams", 1, "LOW"],
  ];

  let used = 0;
  const plan: RequestBudgetPlanEntry[] = order.map(([name, requestsPerDay, priority]) => {
    const allow = used + requestsPerDay <= dailyBudget;
    if (allow) used += requestsPerDay;
    return {
      name,
      requestsPerDay,
      priority,
      refreshIntervalHours: Number((24 / requestsPerDay).toFixed(2)),
      cacheTTL: ProviderCachePolicy[name]?.cacheTTL ?? 0,
      deferIfBudgetExceeded: !allow,
    };
  });

  return {
    dailyBudget,
    requestsPerDay: used,
    remaining: dailyBudget - used,
    withinBudget: plan.every((x) => !x.deferIfBudgetExceeded),
    plan,
  };
}

// ----- Re-exports --------------------------------------------------------

export { NullIdentityResolver as WaveBNullIdentityResolver };