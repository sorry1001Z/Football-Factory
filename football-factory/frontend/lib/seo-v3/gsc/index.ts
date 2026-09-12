// Football Factory — SEO V3 GSC barrel (Wave D).
//
// Generic, domain-neutral Search Console feedback loop:
//   - SearchMetricsProvider contract + FixtureSearchMetricsProvider
//   - Opportunity classifier (8 advisory types)
//   - Aggregation helpers
//
// No real Google credentials. No fetch. Production Search Console
// integration is deferred until credentials are explicitly approved.

export * from "./types";
export * from "./provider";
export * from "./fixture-provider";
export * from "./classifier";
export * from "./aggregates";
