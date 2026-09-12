// Football Factory — consent module barrel (R2.1 Wave B).
//
// Public surface for the consent primitives. The existing analytics
// provider registry under `lib/analytics/provider.tsx` remains
// authoritative — this module only ADDS the primitives needed to
// persist user preferences and gate analytics / ads behind explicit
// consent.

export * from "./version";
export * from "./snapshot";
export * from "./storage";
export * from "./bridge";
