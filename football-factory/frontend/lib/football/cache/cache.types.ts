// Football Factory — cache abstraction (Phase 1.C).
// Phase 1.C uses an in-memory implementation. The interface is stable so
// the underlying storage can later be replaced (Vercel KV, Redis, file)
// without touching the FootballService or the routes.
//
// Cache values are arbitrary JSON-serialisable data. The cache does NOT
// store secret material. Cache keys are deterministic strings.

export type CacheFreshness = 'fresh' | 'stale';

export interface CacheEntry<T> {
  /** The cached value. Must NOT contain API keys, Authorization headers, or raw provider payloads the caller asked us to keep out. */
  value: T;
  /** ISO timestamp when the entry was stored. */
  created_at: string;
  /** ISO timestamp after which the entry is considered stale (preferred to fetch fresh). */
  expires_at: string;
  /** Optional ISO timestamp after which the entry must NOT be served even as stale. */
  stale_until?: string;
  /** Optional provider name that produced the entry. Useful for diagnostics. */
  provider?: string;
}

export interface CacheGetResult<T> {
  hit: boolean;
  freshness: CacheFreshness | 'miss' | 'expired';
  entry?: CacheEntry<T>;
}

export interface CacheLayer<T = unknown> {
  /** Deterministic key derived from caller; should not contain secrets. */
  get(key: string): CacheGetResult<T>;
  set(key: string, value: T, opts: { ttl_ms: number; stale_ttl_ms?: number; provider?: string }): void;
  delete(key: string): boolean;
  /** Wipe all entries. Used by tests and by future admin endpoints. */
  clear(): void;
  /** Snapshot for /api/football/health diagnostics. Never returns entry values. */
  stats(): { size: number; provider_counts?: Record<string, number> };
}

// ----- key helpers --------------------------------------------------------

/**
 * Build a deterministic cache key. Version prefix lets us invalidate
 * every entry of a particular shape when the schema changes.
 *
 * NEVER pass secrets (API keys, Authorization values) into this builder.
 */
export function buildCacheKey(
  parts: ReadonlyArray<string | number | undefined>,
): string {
  const cleaned: string[] = [];
  for (const p of parts) {
    if (p === undefined) continue;
    cleaned.push(String(p));
  }
  return cleaned.join('|');
}
