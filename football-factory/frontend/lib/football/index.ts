// Football Factory — index re-exports (Phase 1.C adds the service surface).

export * from './types';
export type { FootballProvider } from './provider';
export { BaseStubProvider } from './provider';

export * from './cache';
export * from './quota';
export { retry, DEFAULT_RETRY } from './retry';
export type { RetryConfig } from './retry';
export {
  resolveProvider,
  isAllowedProvider,
  listAllowedProviders,
  ProviderResolutionError,
} from './provider-resolver';
export {
  FootballService,
  httpStatusForKind,
  quotaStatusToKind,
} from './football-service';
export type {
  ServiceRequest,
  ServiceEnvelope,
  ServiceEnvelopeOk,
  ServiceEnvelopeErr,
  OperationKind,
} from './football-service';

export { FootballDataProvider, FootballDataClient } from './providers/football-data';
export { ApiFootballProvider, ApiFootballClient } from './providers/api-football';
export { ProviderError } from './providers/_shared';
