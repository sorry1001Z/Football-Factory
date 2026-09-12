// Football Factory — Football Roster Provider Contract (Image System).
//
// Adapter interface for fetching person-team relationships. The
// production provider is deferred until a roster data source is
// approved. For now, callers pass a `roster` array directly into
// the eligibility evaluator.
//
// Implementations MUST:
//   - never call raw football APIs directly from this module
//   - reuse the existing FootballService / provider abstraction
//   - return normalized `PersonTeamRelationship` records with
//     ISO dates and `verifiedAt` timestamps

import type { PersonTeamRelationship, RelationshipStatus } from "./types";

export interface FootballRosterProvider {
  /**
   * Returns the player-team relationship for a (person, team)
   * pair, or null if no record exists.
   */
  getPlayerTeamRelationship(args: {
    personId: string;
    teamId: string;
  }): Promise<PersonTeamRelationship | null>;

  /**
   * Returns the manager-team relationship for a (person, team)
   * pair, or null if no record exists.
   */
  getManagerTeamRelationship(args: {
    personId: string;
    teamId: string;
  }): Promise<PersonTeamRelationship | null>;

  /**
   * Returns the full active roster for a team at the given date.
   * "Active" is provider-defined; callers should not assume any
   * specific status.
   */
  getTeamRosterAtDate(args: {
    teamId: string;
    date: string;
  }): Promise<readonly PersonTeamRelationship[]>;

  /**
   * Returns the currently-installed manager for a team, or null if
   * unknown / vacant.
   */
  getCurrentManager(args: {
    teamId: string;
  }): Promise<PersonTeamRelationship | null>;

  /**
   * Returns the full person-team history for a given person.
   * Useful for feature/profile articles that span multiple clubs.
   */
  getPersonHistory(args: {
    personId: string;
  }): Promise<readonly PersonTeamRelationship[]>;
}

/**
 * A minimal roster provider stub useful for tests and fixtures.
 * Returns whatever the caller hands to the constructor.
 *
 * NEVER use this in production — it returns caller-supplied data
 * verbatim. Real providers must hit an authoritative source.
 */
export class StaticRosterProvider implements FootballRosterProvider {
  constructor(private readonly records: readonly PersonTeamRelationship[] = []) {}

  private find(personId: string, teamId: string): PersonTeamRelationship | null {
    const matches = this.records.filter(
      (r) => r.personId === personId && r.teamId === teamId,
    );
    if (matches.length === 0) return null;
    const sorted = [...matches].sort((a, b) =>
      (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? ""),
    );
    return sorted[0] ?? null;
  }

  async getPlayerTeamRelationship({
    personId,
    teamId,
  }: {
    personId: string;
    teamId: string;
  }): Promise<PersonTeamRelationship | null> {
    const r = this.find(personId, teamId);
    if (!r || r.role !== "PLAYER") return null;
    return r;
  }

  async getManagerTeamRelationship({
    personId,
    teamId,
  }: {
    personId: string;
    teamId: string;
  }): Promise<PersonTeamRelationship | null> {
    const r = this.find(personId, teamId);
    if (!r || r.role !== "MANAGER") return null;
    return r;
  }

  async getTeamRosterAtDate({
    teamId,
    date,
  }: {
    teamId: string;
    date: string;
  }): Promise<readonly PersonTeamRelationship[]> {
    const t = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
    return this.records.filter((r) => {
      if (r.teamId !== teamId) return false;
      if (r.status !== ("ACTIVE" as RelationshipStatus) && r.status !== ("LOAN" as RelationshipStatus)) return false;
      if (r.validFrom) {
        const f = Date.parse(`${r.validFrom.slice(0, 10)}T00:00:00Z`);
        if (Number.isFinite(f) && t < f) return false;
      }
      if (r.validTo) {
        const v = Date.parse(`${r.validTo.slice(0, 10)}T00:00:00Z`);
        if (Number.isFinite(v) && t > v) return false;
      }
      return true;
    });
  }

  async getCurrentManager({
    teamId,
  }: {
    teamId: string;
  }): Promise<PersonTeamRelationship | null> {
    const matches = this.records.filter(
      (r) => r.teamId === teamId && r.role === "MANAGER" && r.status === "ACTIVE",
    );
    const sorted = [...matches].sort((a, b) =>
      (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? ""),
    );
    return sorted[0] ?? null;
  }

  async getPersonHistory({
    personId,
  }: {
    personId: string;
  }): Promise<readonly PersonTeamRelationship[]> {
    return this.records.filter((r) => r.personId === personId);
  }
}
