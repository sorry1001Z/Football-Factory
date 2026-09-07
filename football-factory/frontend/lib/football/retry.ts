// Football Factory — bounded retry helper (Phase 1.C).
// Only retries transient failures: 429, network timeouts, selected 5xx.
// Does NOT retry: 401, 403, 404, invalid payload, config errors.

import { ProviderError, type ProviderErrorKind } from './providers/_shared';

export interface RetryConfig {
  max_retries: number;            // total retries AFTER the first attempt
  initial_backoff_ms: number;     // base delay
  max_backoff_ms: number;         // cap on the computed delay
  jitter_ms: number;              // +/- jitter
}

export const DEFAULT_RETRY: RetryConfig = {
  max_retries: 2,
  initial_backoff_ms: 250,
  max_backoff_ms: 4_000,
  jitter_ms: 100,
};

export interface SleepLike {
  (ms: number): Promise<void>;
}

const RETRYABLE_KINDS: ReadonlySet<ProviderErrorKind> = new Set([
  'RATE_LIMIT',
  'HTTP_ERROR', // only when status >= 500; handled below
]);

function isRetryable(err: unknown, retry_cfg: RetryConfig): boolean {
  if (err instanceof ProviderError) {
    if (err.kind === 'RATE_LIMIT') return true;
    if (err.kind === 'HTTP_ERROR' && typeof err.http_status === 'number' && err.http_status >= 500) return true;
    return false;
  }
  // Untyped errors (e.g. raw network failures) are retryable by default.
  return retry_cfg.max_retries >= 0;
}

function backoffDelay(attempt: number, cfg: RetryConfig, rand: () => number): number {
  const base = cfg.initial_backoff_ms * Math.pow(2, attempt);
  const capped = Math.min(base, cfg.max_backoff_ms);
  const jitter = (rand() * 2 - 1) * cfg.jitter_ms; // [-jitter_ms, +jitter_ms]
  return Math.max(0, Math.floor(capped + jitter));
}

/**
 * Run `fn` up to (1 + max_retries) times, retrying on transient errors.
 * Returns the success value or throws the final error.
 *
 * The injected `sleep` factory exists so tests can advance virtual time
 * without real wall-clock delays.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  cfg: Partial<RetryConfig> = {},
  deps: { sleep?: SleepLike; rand?: () => number } = {},
): Promise<T> {
  const retry_cfg: RetryConfig = { ...DEFAULT_RETRY, ...cfg };
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rand = deps.rand ?? Math.random;

  let last_error: unknown;
  for (let attempt = 0; attempt <= retry_cfg.max_retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last_error = err;
      if (attempt >= retry_cfg.max_retries) break;
      if (!isRetryable(err, retry_cfg)) break;
      try {
        await sleep(backoffDelay(attempt, retry_cfg, rand));
      } catch {
        // sleep failure must NOT mask the original error from fn.
        break;
      }
    }
  }
  throw last_error;
}
