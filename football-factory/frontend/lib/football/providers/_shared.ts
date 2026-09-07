// Football Factory — shared provider infrastructure.
// Phase 1.B. Error model, fetch helper, status mapping.

import type { MatchStatus, ProviderName } from '../types';

// ----- structured provider errors ----------------------------------------

export type ProviderErrorKind =
  | 'CONFIG_ERROR'        // API key missing / placeholder
  | 'AUTH_ERROR'          // 401 / 403
  | 'RATE_LIMIT'          // 429
  | 'HTTP_ERROR'          // other non-2xx
  | 'INVALID_PAYLOAD'     // JSON parse failed / shape wrong
  | 'NOT_FOUND'           // 404
  | 'UNSUPPORTED';        // operation not available on this provider / plan

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: ProviderName;
  readonly http_status?: number;
  readonly safe_message: string; // message safe to log/return to caller; never includes the key

  constructor(
    kind: ProviderErrorKind,
    provider: ProviderName,
    safe_message: string,
    options: { http_status?: number; cause?: unknown } = {},
  ) {
    super(`[${provider}] ${kind}: ${safe_message}`);
    this.name = 'ProviderError';
    this.kind = kind;
    this.provider = provider;
    this.http_status = options.http_status;
    this.safe_message = safe_message;
    if (options.cause !== undefined) {
      // cause is intentionally NOT exposed on the prototype to avoid leaking
      // raw Error objects. Callers can wrap before passing.
    }
  }
}

// ----- sanitized log helper ----------------------------------------------

/** Produce a string safe to print. NEVER accepts secrets as arguments. */
export function safeLog(provider: ProviderName, op: string, detail: string): string {
  return `[${provider}] ${op}: ${detail}`;
}

// ----- status mapping ----------------------------------------------------

/**
 * Map a free-form provider status string to canonical MatchStatus.
 * Returns 'unknown' for unrecognized values; callers may then mark the
 * record data_quality_status = 'partial'.
 */
export function normalizeMatchStatus(input: unknown): MatchStatus {
  if (typeof input !== 'string') return 'unknown';
  const s = input.trim().toUpperCase();
  if (s === '') return 'unknown';

  // football-data.org values
  if (s === 'SCHEDULED' || s === 'TIMED' || s === 'NS') return 'scheduled';
  if (s === 'IN_PLAY' || s === 'LIVE' || s === 'IN_PROGRESS' || s === '1H' || s === '2H' ||
      s === 'HT' || s === 'ET' || s === 'P' || s === 'BT' || s === 'SUSPENDED' || s === 'INTERRUPTED' ||
      s === 'SUSP' || s === 'INT' || s === 'PAUSED') {
    return 'live';
  }
  if (s === 'FINISHED' || s === 'FT' || s === 'AET' || s === 'PEN' || s === 'AWARDED' || s === 'COMPLETED') {
    return 'finished';
  }
  if (s === 'POSTPONED' || s === 'DELAYED' || s === 'PST') return 'postponed';
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'CANC' || s === 'ABANDONED' || s === 'WALKOVER' || s === 'ABD' || s === 'WO') return 'cancelled';

  return 'unknown';
}

// ----- fetch helper ------------------------------------------------------

export interface FetchOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeout_ms?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Issue an HTTP request and return parsed JSON.
 *
 * SAFETY RULES:
 *   - Never logs the Authorization header value.
 *   - Never includes the header value in error messages or ProviderError.
 *   - All thrown ProviderError instances carry only safe_message strings.
 *
 * The `headers` parameter is typed loosely so callers can pass an `Auth`
 * header without that header value being inspected anywhere in this file.
 */
export async function fetchJson(
  provider: ProviderName,
  url: string,
  headers: Record<string, string>,
  options: FetchOptions = {},
): Promise<unknown> {
  const timeout = options.timeout_ms ?? 10_000;
  const method = options.method ?? 'GET';

  let fullUrl = url;
  if (options.query) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(options.query)) {
      if (v === undefined) continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    if (parts.length) {
      fullUrl += (url.includes('?') ? '&' : '?') + parts.join('&');
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    const fetchToUse = options.fetchImpl ?? fetch;
    response = await fetchToUse(fullUrl, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    clearTimeout(timer);
    throw new ProviderError('HTTP_ERROR', provider, 'network failure');
  }
  clearTimeout(timer);

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError('AUTH_ERROR', provider, `auth rejected (${response.status})`, { http_status: response.status });
  }
  if (response.status === 404) {
    throw new ProviderError('NOT_FOUND', provider, 'resource not found', { http_status: response.status });
  }
  if (response.status === 429) {
    throw new ProviderError('RATE_LIMIT', provider, 'rate limited', { http_status: response.status });
  }
  if (response.status < 200 || response.status >= 300) {
    throw new ProviderError('HTTP_ERROR', provider, `http ${response.status}`, { http_status: response.status });
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new ProviderError('INVALID_PAYLOAD', provider, 'response body is not valid JSON', { http_status: response.status });
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new ProviderError('INVALID_PAYLOAD', provider, 'response body is not a JSON object', { http_status: response.status });
  }
  return parsed;
}
