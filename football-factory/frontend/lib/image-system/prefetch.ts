// Football Factory — Image System metadata prefetch (R2 Wave 1).
//
// Adapted from the external Football Image System R2 pack (src/prefetch.ts).
// METADATA-ONLY. This module NEVER downloads image binaries. Hotlinking
// is also out of scope here — callers must invoke canDownloadBinary()
// after a positive publicationDecision() if they need a binary.
//
// Index interface intentionally lives in this file as a thin contract.
// The R2 pack's in-memory JsonAssetIndex is exported as `test-only` from
// `./__test-hooks__/json-asset-index.ts` so it cannot be accidentally
// imported as production storage.

import { canCacheMetadata } from "./policy";
import type { Asset, SourcePolicy } from "./types";

/**
 * Persisted or in-memory metadata index. Production implementations
 * should back this with a database; for now this interface is the
 * contract and the in-memory implementation lives in test hooks.
 */
export interface AssetIndex {
  upsert(a: Asset): Promise<void>;
  get(id: string): Promise<Asset | undefined>;
  find(q: {
    player?: string;
    team?: string;
    competition?: string;
    tags?: string[];
  }): Promise<Asset[]>;
  byCanonical(url: string): Promise<Asset | undefined>;
  quarantine(
    id: string,
    reason: "license" | "source",
  ): Promise<void>;
}

export interface SourceAdapter {
  sourceName: string;
  search(q: string): Promise<Asset[]>;
  refresh(asset: Asset): Promise<Asset>;
}

/**
 * Run metadata-prefetch across all configured sources.
 *
 * Behavior:
 *   - Skips sources that don't pass canCacheMetadata().
 *   - Iterates queries per source.
 *   - For each search result, checks the canonical dedupe key.
 *   - Skips rows still within metadata_cache_ttl_hours.
 *   - Otherwise upserts with last_verified_at = now.
 *
 * Returns counters so callers (a future cron job) can log progress.
 */
export class MetadataPrefetchJob {
  constructor(
    private index: AssetIndex,
    private sources: Map<string, SourceAdapter>,
    private policies: Map<string, SourcePolicy>,
  ) {}

  async run(queries: string[]): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;
    for (const [name, adapter] of this.sources) {
      const policy = this.policies.get(name);
      if (!policy || !canCacheMetadata(policy)) {
        skipped++;
        continue;
      }
      for (const q of queries) {
        for (const a of await adapter.search(q)) {
          const old = await this.index.byCanonical(a.canonical_source_url);
          if (
            old &&
            Date.now() - Date.parse(old.last_verified_at) <
              policy.metadata_cache_ttl_hours * 3600000
          ) {
            continue;
          }
          await this.index.upsert({
            ...a,
            last_verified_at: new Date().toISOString(),
          });
          synced++;
        }
      }
    }
    return { synced, skipped };
  }
}

/**
 * Stale-detection helper. Pure. Returns true when the asset's
 * last_verified_at is older than ttlHours ago (default 168h = 7 days,
 * matching the registry seed).
 */
export const isStale = (a: Asset, ttlHours = 168): boolean =>
  Date.now() - Date.parse(a.last_verified_at) > ttlHours * 3600000;
