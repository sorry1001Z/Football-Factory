// Football Factory — Banner Composer Module Barrel (Image System).
//
// Concerns:
//   - Reusing the entity-freshness gate to choose WHICH people
//     are valid for a banner.
//   - Deterministic priority, multi-person limit (1..3), and
//     layout suggestion.
//
// Does NOT cover image rights (lib/image-system/policy.ts).
// Does NOT generate images or prompts.

export * from "./types";
export * from "./selection";
export * from "./compose";
