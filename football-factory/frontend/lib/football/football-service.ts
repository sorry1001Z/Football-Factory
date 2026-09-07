// Football Factory — FootballService (Phase 1.C).
// Thin orchestration layer used by /api/football/* route handlers.
//
// Flow:
//   validate → resolve provider → cache lookup → quota check
//     → provider call (retry if eligible) → normalize
//     → validate → cache write → return canonical envelope

import { ProviderError } from './providers/_shared';
import { resolveProvider, ProviderResolutionError } from './provider-resolver';
import { MemoryCache, buildCacheKey, type CacheLayer } from './cache';
import type { InMemoryQuotaManager } from './quota';
import { retry, DEFAULT_RETRY, type RetryConfig } from './retry';
import type { ProviderName } from './types';

// ----- operation kinds ---------------------------------------------------

export type OperationKind = 'competitions' | 'matches' | 'standings' | 'teams';

export interface ServiceRequest {
  operation: OperationKind;
  provider?: ProviderName;
  params?: Record<string, string | number | undefined>;
}

export interface ServiceEnvelopeOk<T> {
  ok: true;
  provider: ProviderName;
  data: T;
  meta: {
    cached: boolean;
    stale: boolean;
    fetched_at: string;
    correlation_id: string;
    quota?: { requests_in_window: number; daily_limit: number; status: string };
  };
}

export interface ServiceEnvelopeErr {
  ok: false;
  error: {
    kind: string;
    safe_message: string;
    provider: ProviderName | null;
  };
  meta: {
    correlation_id: string;
  };
}

export type ServiceEnvelope<T> = ServiceEnvelopeOk<T> | ServiceEnvelopeErr;

// ----- TTL map ----------------------------------------------------------

const TTL_MS: Record<OperationKind, number> = {
  competitions: 6 * 60 * 60 * 1000,  // 6h
  teams:        6 * 60 * 60 * 1000,  // 6h
  standings:    10 * 60 * 1000,     // 10m
  matches:      5 * 60 * 1000,      // 5m
};

// Stale-while-revalidate window for completed/scheduled matches (optional)
const STALE_MS: Partial<Record<OperationKind, number>> = {
  matches: 10 * 60 * 1000, // extra 10m stale window
};

// ----- error mapping ----------------------------------------------------

const KIND_TO_HTTP: Record<string, number> = {
  CONFIG_ERROR: 503,
  AUTH_ERROR:   502,
  RATE_LIMIT:   429,
  HTTP_ERROR:   502,
  INVALID_PAYLOAD: 502,
  NOT_FOUND:    404,
  UNSUPPORTED:  501,
};

export function httpStatusForKind(kind: string): number {
  return KIND_TO_HTTP[kind] ?? 500;
}

export function quotaStatusToKind(status: 'ok' | 'soft' | 'hard'): string {
  return status === 'hard' ? 'RATE_LIMIT' : 'QUOTA_LIMIT';
}

function newCorrelationId(): string {
  // Node 18+ has globalThis.crypto.randomUUID in edge runtime too.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `cor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function errEnvelope(provider: ProviderName | null, kind: string, safe_message: string, correlation_id: string): ServiceEnvelopeErr {
  return {
    ok: false,
    error: { kind, safe_message, provider },
    meta: { correlation_id },
  };
}

// ----- service ----------------------------------------------------------

export interface FootballServiceOptions {
  cache?: CacheLayer;
  quota: InMemoryQuotaManager;
  env?: { FOOTBALL_PROVIDER?: string };
  api_keys?: Partial<Record<'football-data.org' | 'api-football', string | undefined>>;
  retry_cfg?: Partial<RetryConfig>;
  now?: () => number;   // test injection
}

export class FootballService {
  private readonly cache: CacheLayer;
  private readonly quota: InMemoryQuotaManager;
  private readonly api_keys: FootballServiceOptions['api_keys'];
  private readonly retry_cfg: Partial<RetryConfig>;
  private readonly env_provider: string | undefined;
  private readonly now: () => number;

  constructor(opts: FootballServiceOptions) {
    this.cache = opts.cache ?? new MemoryCache();
    this.quota = opts.quota;
    this.api_keys = opts.api_keys;
    this.retry_cfg = opts.retry_cfg ?? {};
    this.env_provider = opts.env?.FOOTBALL_PROVIDER;
    this.now = opts.now ?? Date.now;
  }

  /** Resolve the requested provider name (request > env > default). */
  resolveProviderName(requested?: ProviderName): 'football-data.org' | 'api-football' {
    const want = requested ?? (this.env_provider as ProviderName | undefined) ?? 'football-data.org';
    if (want === 'football-data.org' || want === 'api-football') return want;
    // Unknown request → fall through to default. ProviderResolutionError is
    // thrown later if the env value is malformed and a request explicitly
    // names a non-allowed provider.
    return 'football-data.org';
  }

  async handle<T>(req: ServiceRequest): Promise<ServiceEnvelope<T>> {
    const correlation_id = newCorrelationId();

    // 1. Resolve provider name with safe fallback
    let provider_name: 'football-data.org' | 'api-football';
    try {
      if (req.provider && (req.provider === 'football-data.org' || req.provider === 'api-football')) {
        provider_name = req.provider;
      } else {
        provider_name = this.resolveProviderName(req.provider);
      }
    } catch (e) {
      if (e instanceof ProviderResolutionError) {
        return errEnvelope(null, 'CONFIG_ERROR', `unsupported provider "${e.requested}"`, correlation_id);
      }
      throw e;
    }

    // 2. Quota check BEFORE cache write attempts (no point caching if blocked)
    if (!this.quota.canRequest(provider_name)) {
      const snap = this.quota.snapshot(provider_name);
      return errEnvelope(provider_name, 'RATE_LIMIT',
        `quota exhausted for ${provider_name}`, correlation_id);
    }

    // 3. Build cache key + look up
    const cache_key = buildCacheKey([
      'v1', req.operation, provider_name,
      ...Object.entries(req.params ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v ?? ''}`),
    ]);
    const cached = this.cache.get(cache_key);
    if (cached.hit && cached.freshness === 'fresh') {
      return {
        ok: true,
        provider: provider_name,
        data: cached.entry!.value as T,
        meta: {
          cached: true,
          stale: false,
          fetched_at: cached.entry!.created_at,
          correlation_id,
        },
      };
    }

    // 4. Execute against provider (with retry)
    let result: T;
    let provider_fetched_at: string;
    try {
      const fetched = await retry(() => this.callProvider<T>(req, provider_name, correlation_id), this.retry_cfg);
      result = fetched.value;
      provider_fetched_at = fetched.fetched_at;
    } catch (e) {
      if (e instanceof ProviderError) {
        if (e.kind === 'RATE_LIMIT') this.quota.recordRateLimit(provider_name);
        return errEnvelope(provider_name, e.kind, e.safe_message, correlation_id);
      }
      if (e instanceof ProviderResolutionError) {
        return errEnvelope(null, 'CONFIG_ERROR', `unsupported provider "${e.requested}"`, correlation_id);
      }
      return errEnvelope(provider_name, 'HTTP_ERROR', 'unexpected provider failure', correlation_id);
    }

    // 5. Record success + write cache
    this.quota.recordRequest(provider_name);
    this.cache.set(cache_key, result as unknown, {
      ttl_ms: TTL_MS[req.operation],
      stale_ttl_ms: STALE_MS[req.operation],
      provider: provider_name,
    });

    return {
      ok: true,
      provider: provider_name,
      data: result,
      meta: {
        cached: false,
        stale: false,
        fetched_at: provider_fetched_at,
        correlation_id,
        quota: (() => {
          const s = this.quota.snapshot(provider_name);
          return { requests_in_window: s.requests_in_window, daily_limit: s.daily_limit, status: s.status };
        })(),
      },
    };
  }

  /** Provider call surface. Subclasses / tests can override. */
  protected async callProvider<T>(
    req: ServiceRequest,
    provider_name: 'football-data.org' | 'api-football',
    _correlation_id: string,
  ): Promise<{ value: T; fetched_at: string }> {
    const provider = resolveProvider(provider_name, { api_keys: this.api_keys });
    const fetched_at = new Date(this.now()).toISOString();
    switch (req.operation) {
      case 'competitions':
        return { value: (await provider.getCompetitions()) as unknown as T, fetched_at };
      case 'teams':
        return { value: (await provider.getTeams(req.params)) as unknown as T, fetched_at };
      case 'standings':
        return { value: (await provider.getStandings(req.params)) as unknown as T, fetched_at };
      case 'matches':
        // For now, treat the request as results. Fixtures/Results split
        // can be added later via a richer params shape.
        return { value: (await provider.getResults(req.params)) as unknown as T, fetched_at };
      default:
        throw new ProviderError('UNSUPPORTED', provider_name, `unknown operation "${req.operation}"`);
    }
  }
}
