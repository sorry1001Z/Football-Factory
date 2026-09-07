// Football Factory — in-memory cache implementation.
// Phase 1.C default. Single Node process. Not shared across Vercel
// serverless instances — that is acceptable for the local dev / single-
// instance staging environment we have today. Replace via CacheLayer
// for production scale.

import type { CacheEntry, CacheGetResult, CacheLayer } from './cache.types';

interface InternalEntry<T> {
  value: T;
  created_at: string;
  expires_at: number; // ms epoch
  stale_until?: number; // ms epoch
  provider?: string;
}

export class MemoryCache<T = unknown> implements CacheLayer<T> {
  private readonly store = new Map<string, InternalEntry<T>>();

  get(key: string): CacheGetResult<T> {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return { hit: false, freshness: 'miss' };
    if (now >= entry.expires_at) {
      // Expired. May still be served as stale if stale_until is in the future.
      if (entry.stale_until !== undefined && now < entry.stale_until) {
        return { hit: true, freshness: 'stale', entry: this.toExternal(entry) };
      }
      // Hard-expired — drop and report miss.
      this.store.delete(key);
      return { hit: false, freshness: 'expired' };
    }
    return { hit: true, freshness: 'fresh', entry: this.toExternal(entry) };
  }

  set(key: string, value: T, opts: { ttl_ms: number; stale_ttl_ms?: number; provider?: string }): void {
    if (!Number.isFinite(opts.ttl_ms) || opts.ttl_ms <= 0) {
      throw new Error('MemoryCache.set: ttl_ms must be a positive number');
    }
    const now = Date.now();
    const entry: InternalEntry<T> = {
      value,
      created_at: new Date(now).toISOString(),
      expires_at: now + opts.ttl_ms,
    };
    if (opts.stale_ttl_ms !== undefined && Number.isFinite(opts.stale_ttl_ms) && opts.stale_ttl_ms > 0) {
      entry.stale_until = now + opts.ttl_ms + opts.stale_ttl_ms;
    }
    if (opts.provider !== undefined) entry.provider = opts.provider;
    this.store.set(key, entry);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  stats(): { size: number; provider_counts?: Record<string, number> } {
    const counts: Record<string, number> = {};
    for (const e of this.store.values()) {
      if (e.provider) counts[e.provider] = (counts[e.provider] ?? 0) + 1;
    }
    return { size: this.store.size, provider_counts: counts };
  }

  private toExternal(entry: InternalEntry<T>): CacheEntry<T> {
    return {
      value: entry.value,
      created_at: entry.created_at,
      expires_at: new Date(entry.expires_at).toISOString(),
      stale_until: entry.stale_until !== undefined ? new Date(entry.stale_until).toISOString() : undefined,
      provider: entry.provider,
    };
  }
}
