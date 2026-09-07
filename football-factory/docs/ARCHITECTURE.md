# Football Factory — Architecture

Status: Phase 1.D — foundation, provider layer, API routes, cache,
quota, retry and orchestration are implemented. Phase 2 onwards
(source registry, news collector, AI writer, n8n) is NOT started.

## Purpose

Football Factory is a free-first Thai football media site built on a
headless stack. Visitors must always read content through the public
Next.js frontend. Editorial work happens in WordPress. Football data
is normalised behind a provider abstraction so we are never locked to a
single paid vendor.

## High-level flow
```
Visitors
  ↓
Vercel CDN
  ↓
Next.js (App Router, TypeScript, React 19, Next 15)
  ↓
WPGraphQL / WordPress REST       (Phase 9 — currently mock fallback)
  ↓
Local WordPress (headless CMS)
  ↓
Football Factory Bridge plugin (CPTs, revalidate webhook)
  ↓
Football Factory API layer
  ├─ provider-resolver    (allowlist: football-data.org | api-football)
  ├─ cache                (in-memory, deterministic keys, SWR)
  ├─ quota                (per-provider counters, soft + hard thresholds)
  ├─ retry                (RATE_LIMIT + 5xx only; backoff + jitter)
  └─ providers            (real clients behind `FootballProvider` interface)
  ↓
football-data.org / api-football (free tier)
```

## Boundaries

- WordPress is the editorial CMS. It owns entity management, SEO fields
  and admin-only workflows. It is NOT served directly to visitors.
- WPGraphQL is the public content contract between WordPress and Next.js
  (Phase 9 — currently mock fallback).
- Next.js is the public surface: pages, metadata, canonical, schema,
  sitemap, internal links, ISR cache, revalidation.
- Vercel hosts the frontend and exposes the revalidate endpoint.
- Football Factory API layer normalises football data, resolves
  identities, controls freshness and tracks provider quotas.
- The frontend never imports a provider directly. It only calls
  `/api/football/*` route handlers, which return normalised envelopes.
- n8n orchestrates ingestion, enrichment, QA and publication support
  (Phase 2+ — NOT IMPLEMENTED). n8n MUST NOT write to the WordPress
  database directly — it uses the WordPress REST/GraphQL endpoints with
  proper credentials.
- n8n runs locally (Community Edition / self-hosted). Free tier only.

## Phase 1.D public API surface

| Route                                  | Backend                         | Cache TTL | Notes |
|----------------------------------------|---------------------------------|-----------|-------|
| `GET /api/health`                       | `app/api/health/route.ts`       | n/a       | General frontend health. |
| `GET /api/football/competitions`       | `lib/football/football-service.ts` | 6h    | All known competitions. |
| `GET /api/football/matches`            | `lib/football/football-service.ts` | 5m/10m (SWR) | Filter by `competition`, `season`. |
| `GET /api/football/standings`          | `lib/football/football-service.ts` | 10m   | Filter by `competition`. |
| `GET /api/football/teams`              | `lib/football/football-service.ts` | 6h    | Filter by `competition`. |
| `GET /api/football/health`             | `app/api/football/health/route.ts` | n/a    | Never makes external API calls; booleans only. |
| `GET /api/revalidate`                   | `app/api/revalidate/route.ts`   | n/a       | WordPress Publish webhook. Requires `REVALIDATE_SECRET`. |

All `/api/football/*` handlers are thin: they call `FootballService.handle()`
and serialise the envelope. Orchestration (validate → resolve → cache →
quota → fetch → retry → normalize → cache → return) lives in
`FootballService`.

## Data sources — priority order

1. football-data.org — PRIMARY provider
2. API-Football (free tier) — SECONDARY provider
3. Fallback to the other provider on failure (Phase 2 — currently Phase 1.D
   returns RATE_LIMIT deterministically when primary quota is exhausted)
4. Mocks during development
5. thscore99.com — reference / cross-check only in early phases. NOT a
   production source until Terms, robots.txt and rights have been reviewed.

## Why headless

- Public traffic scales independently of WordPress
- Next.js controls SEO surface 100% (canonical, JSON-LD, sitemap)
- Editorial team keeps the WordPress workflow they already know
- Football data layer stays portable between providers

## Repo layout (this repository)
```
football-factory/
├── frontend/                          Next.js app (Vercel root)
│   ├── app/                           routes + API handlers
│   ├── components/                    Header, Footer, NewsCard, LiveScores, AdSlot
│   ├── lib/football/                  Provider abstraction layer (Phase 1)
│   │   ├── cache/                     CacheLayer interface + MemoryCache
│   │   ├── identity/                  Competition/Team/Player identity resolution
│   │   ├── providers/                 football-data.org + api-football clients + fixtures
│   │   ├── registry/                  Static competition registry
│   │   ├── __tests__/                 Node test runner specs
│   │   ├── types.ts, provider.ts, index.ts
│   │   └── quota.ts, retry.ts, provider-resolver.ts, football-service.ts
│   ├── package.json, tsconfig.json, .env.example, .gitignore
│   └── next-env.d.ts
├── wordpress-plugin/                  Bridge plugin (PHP, single file)
├── docs/                              ARCHITECTURE, ENVIRONMENT, PHASES, etc.
└── README.md
```

## What lives where

- Pages, metadata, sitemap, robots → Next.js (frontend/)
- Posts, CPTs, taxonomies, SEO fields, revalidate trigger → WordPress
  (Phase 9 — bridge plugin stub exists in `wordpress-plugin/`)
- Football canonical schema, provider adapters, cache, quota, retry,
  orchestration → Football Factory API (`lib/football/`)
- News collector, fact engine, confidence engine, Thai content engine →
  n8n + Workers (Phase 2+ — NOT IMPLEMENTED)

## Non-negotiable invariants

1. Visitors never hit the WordPress origin directly.
2. Real API keys never enter code, Git history or logs.
3. Provider payloads are never returned to the frontend raw — always
   through canonical Football Factory schema.
4. Provider classes override `toJSON()` to never leak key material.
5. `REVALIDATE_SECRET` is server-only; never `NEXT_PUBLIC_*`.
6. AUTO_PUBLISH stays false until accuracy metrics prove it is safe.
7. Every workflow has version, owner, error path, retry, audit log and
   dry-run mode.
8. `npm test`, `npm run typecheck`, `npm run build` all pass before any
   checkpoint commit.

## Cache + quota caveats (Phase 1.D)

- Cache is in-memory per Node process. Vercel serverless cold starts get
  a fresh cache. Acceptable for staging, NOT for production scale.
- Quota counters are per-process. Two parallel instances each allow
  `daily_limit` requests. Acceptable for staging.
- Replacement with Redis or Vercel KV is a Phase 2 (or later) task that
  does not require changes to `FootballService` or the route handlers.
