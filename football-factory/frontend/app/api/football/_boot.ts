// Shared boot-time singletons for the /api/football/* routes.
// Created lazily and re-used across requests inside the same Node process.
// These objects live behind server-only route handlers — never imported by
// client components.
//
// NOTE: `import 'server-only'` is omitted here because the Node test
// runner does not enforce the client/server split. Next.js will detect
// the import automatically when this file is bundled into a server route.
// Add it back if/when the project installs the `server-only` package and
// wants build-time enforcement.

import { MemoryCache, type CacheLayer } from '@/lib/football/cache';
import { InMemoryQuotaManager, type QuotaManager } from '@/lib/football/quota';
import { FootballService } from '@/lib/football/football-service';

declare global {
  // eslint-disable-next-line no-var
  var __FF_BOOT__: {
    cache: CacheLayer;
    quota: QuotaManager;
    service: FootballService;
  } | undefined;
}

function boot(): {
  cache: CacheLayer;
  quota: QuotaManager;
  service: FootballService;
} {
  if (globalThis.__FF_BOOT__) return globalThis.__FF_BOOT__;
  const cache: CacheLayer = new MemoryCache();
  const quota = new InMemoryQuotaManager();
  const service = new FootballService({
    cache,
    quota,
    env: { FOOTBALL_PROVIDER: process.env.FOOTBALL_PROVIDER },
    api_keys: {
      'football-data.org': process.env.FOOTBALL_DATA_API_KEY,
      'api-football': process.env.API_FOOTBALL_KEY,
    },
  });
  const bundle = { cache, quota, service };
  globalThis.__FF_BOOT__ = bundle;
  return bundle;
}

export function getBoot() {
  return boot();
}
