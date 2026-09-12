// Football Factory — Entity Freshness Module Barrel (Image System).
//
// Concerns:
//   - Person-team temporal validity (current vs former vs transfer)
//   - Banner eligibility decisions
//   - Roster provider adapter contract
//
// Does NOT cover image rights. Rights evaluation remains
// authoritative in `lib/image-system/policy.ts`.

export * from "./types";
export * from "./person-team-validity";
export * from "./banner-eligibility";
export * from "./roster-provider";
