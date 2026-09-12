// Football Factory — SEO V3 barrel (Wave A + Wave B + Wave C + Wave D).

export * from "./canonical";
export * from "./indexing";
export * from "./schema";
export * from "./analyzers";
export * from "./quality";
export * from "./publish-gate";
export * from "./contracts";
export * from "./intent";
export * from "./internal-links";
export * from "./suggestions";

// Wave D: Search Console feedback loop (fixture-only). Production
// SearchConsole provider is deferred until credentials are
// explicitly approved. Generic + domain-neutral.
export * from "./gsc";

// Wave C: Football-specific adapter lives under adapters/. Domain
// adapters plug into the SeoDomainAdapter interface. The generic
// core remains domain-neutral.
export {
  FootballSeoAdapter,
  footballSeoAdapter,
  FOOTBALL_INTENT_RULES,
  REAL_INTENT_RULES,
  isKnownFootballLandingPageType,
  PLAYER_IDENTITY_RESOLUTION_DEFERRED,
  MATCH_CANONICAL_RESOLUTION_DEFERRED,
  type FootballSeoAdapterOptions,
} from "./adapters/football-adapter";
