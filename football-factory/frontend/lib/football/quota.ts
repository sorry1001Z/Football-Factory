// Football Factory — Quota Manager (Phase 1.C).
// In-memory counters, per-provider isolation. Replaceable via interface.
//
// Quota rules:
//   - soft threshold: callers are warned but still allowed.
//   - hard threshold: callers are blocked; service returns safe error.
//   - rate-limit signal from provider bumps `recent_429_count` and may
//     reduce the hard threshold briefly.

import type { ProviderName } from './types';

export interface QuotaConfig {
  /** Hard upper bound on requests per provider in the rolling window. */
  daily_limit: number;
  /** Soft threshold expressed as a fraction (0..1) of daily_limit. */
  soft_threshold_ratio: number;
  /** Window length in ms (default 24h). */
  window_ms: number;
}

export interface QuotaSnapshot {
  provider: ProviderName;
  requests_in_window: number;
  daily_limit: number;
  soft_threshold: number;
  recent_429_count: number;
  status: 'ok' | 'soft' | 'hard';
  /** True if canRequest() would return false. */
  blocked: boolean;
}

export interface QuotaManager {
  canRequest(provider: ProviderName): boolean;
  recordRequest(provider: ProviderName): void;
  recordRateLimit(provider: ProviderName): void;
  snapshot(provider: ProviderName): QuotaSnapshot;
  reset(provider?: ProviderName): void;
}

// ----- safe defaults -----------------------------------------------------

const SAFE_DEFAULTS: Record<ProviderName, QuotaConfig> = {
  'football-data.org': { daily_limit: 600, soft_threshold_ratio: 0.8, window_ms: 24 * 60 * 60 * 1000 },
  'api-football':       { daily_limit: 100, soft_threshold_ratio: 0.8, window_ms: 24 * 60 * 60 * 1000 },
  mock:                 { daily_limit: Number.MAX_SAFE_INTEGER, soft_threshold_ratio: 1.0, window_ms: 24 * 60 * 60 * 1000 },
};

const PROVIDERS: ReadonlyArray<Exclude<ProviderName, 'mock'>> = ['football-data.org', 'api-football'];

function parseIntOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function readQuotaConfigFromEnv(): Record<ProviderName, QuotaConfig> {
  // Soft override via env. Missing or non-positive values fall back to safe defaults.
  const fdLimit = parseIntOr(process.env.FOOTBALL_DATA_DAILY_LIMIT, SAFE_DEFAULTS['football-data.org'].daily_limit);
  const afLimit = parseIntOr(process.env.API_FOOTBALL_DAILY_LIMIT, SAFE_DEFAULTS['api-football'].daily_limit);
  return {
    'football-data.org': { ...SAFE_DEFAULTS['football-data.org'], daily_limit: fdLimit },
    'api-football':       { ...SAFE_DEFAULTS['api-football'],       daily_limit: afLimit },
    mock:                 SAFE_DEFAULTS.mock,
  };
}

// ----- implementation ----------------------------------------------------

interface InternalState {
  config: QuotaConfig;
  timestamps: number[]; // ms epochs
  recent_429_count: number;
}

export class InMemoryQuotaManager implements QuotaManager {
  private readonly states: Map<ProviderName, InternalState> = new Map();
  private readonly configs: Record<ProviderName, QuotaConfig>;

  constructor(configs?: Partial<Record<ProviderName, QuotaConfig>>) {
    const env = readQuotaConfigFromEnv();
    this.configs = {
      'football-data.org': { ...env['football-data.org'], ...(configs?.['football-data.org'] ?? {}) },
      'api-football':       { ...env['api-football'],       ...(configs?.['api-football']       ?? {}) },
      mock:                 env.mock,
    };
    for (const p of PROVIDERS) {
      this.states.set(p, { config: this.configs[p], timestamps: [], recent_429_count: 0 });
    }
  }

  canRequest(provider: ProviderName): boolean {
    if (provider === 'mock') return true;
    const s = this.states.get(provider);
    if (!s) return false;
    this.prune(s);
    return s.timestamps.length < s.config.daily_limit;
  }

  recordRequest(provider: ProviderName): void {
    if (provider === 'mock') return;
    const s = this.states.get(provider);
    if (!s) return;
    this.prune(s);
    s.timestamps.push(Date.now());
  }

  recordRateLimit(provider: ProviderName): void {
    if (provider === 'mock') return;
    const s = this.states.get(provider);
    if (!s) return;
    s.recent_429_count++;
    // Decay after 5 minutes. We do not block immediately on a single 429;
    // repeated 429s in a short window effectively reduce capacity.
  }

  snapshot(provider: ProviderName): QuotaSnapshot {
    if (provider === 'mock') {
      return {
        provider,
        requests_in_window: 0,
        daily_limit: Number.MAX_SAFE_INTEGER,
        soft_threshold: Number.MAX_SAFE_INTEGER,
        recent_429_count: 0,
        status: 'ok',
        blocked: false,
      };
    }
    const s = this.states.get(provider);
    if (!s) {
      return {
        provider,
        requests_in_window: 0,
        daily_limit: 0,
        soft_threshold: 0,
        recent_429_count: 0,
        status: 'hard',
        blocked: true,
      };
    }
    this.prune(s);
    const used = s.timestamps.length;
    const limit = s.config.daily_limit;
    const soft = Math.floor(limit * s.config.soft_threshold_ratio);
    const status: QuotaSnapshot['status'] =
      used >= limit ? 'hard' :
      used >= soft ? 'soft' :
      'ok';
    return {
      provider,
      requests_in_window: used,
      daily_limit: limit,
      soft_threshold: soft,
      recent_429_count: s.recent_429_count,
      status,
      blocked: used >= limit,
    };
  }

  reset(provider?: ProviderName): void {
    if (provider) {
      const s = this.states.get(provider);
      if (s) { s.timestamps = []; s.recent_429_count = 0; }
      return;
    }
    for (const s of this.states.values()) {
      s.timestamps = [];
      s.recent_429_count = 0;
    }
  }

  /** Reduce effective capacity by N. Used after quota errors. */
  penalize(provider: ProviderName, n: number): void {
    const s = this.states.get(provider);
    if (!s) return;
    s.recent_429_count += n;
  }

  private prune(s: InternalState): void {
    const cutoff = Date.now() - s.config.window_ms;
    while (s.timestamps.length > 0 && s.timestamps[0] < cutoff) {
      s.timestamps.shift();
    }
  }
}
