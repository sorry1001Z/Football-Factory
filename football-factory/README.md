# Football Factory — Free-First Thai Football Media

WordPress Headless + WPGraphQL + Next.js + Vercel + Football Factory API + n8n.

Phase 0 → Phase 1.D complete (documentation, foundation, mock-friendly
provider layer, API routes, cache, quota, retry, orchestration). No paid
services. No real provider keys required to build / typecheck / test.

---

## Repository layout

```
football-factory/
├── frontend/                    # Next.js 15 App Router (Vercel root)
│   ├── app/                     # routes + API handlers
│   │   ├── api/football/        # /api/football/{competitions,matches,standings,teams,health}
│   │   ├── api/health/          # /api/health (general frontend health)
│   │   ├── api/revalidate/      # /api/revalidate (WPGraphQL publish hook)
│   │   ├── league/[slug]/page.tsx
│   │   ├── match/[slug]/page.tsx
│   │   ├── news/[slug]/page.tsx
│   │   ├── team/[slug]/page.tsx
│   │   ├── page.tsx, layout.tsx, globals.css
│   │   ├── robots.ts, sitemap.ts
│   ├── components/              # Header, Footer, NewsCard, LiveScores, AdSlot
│   ├── lib/football/            # Provider abstraction layer (Phase 1)
│   │   ├── cache/                # CacheLayer interface + MemoryCache
│   │   ├── identity/             # Competition/Team/Player identity resolution
│   │   ├── providers/            # football-data.org + api-football clients
│   │   ├── registry/             # Static competition registry
│   │   ├── __tests__/            # Node test runner specs
│   │   ├── types.ts, provider.ts, index.ts
│   │   ├── quota.ts, retry.ts, provider-resolver.ts, football-service.ts
│   ├── package.json, tsconfig.json, .env.example, .gitignore
│   ├── next-env.d.ts
├── wordpress-plugin/            # Football Factory Headless Bridge (Phase 0)
│   └── football-factory-headless-bridge/
├── docs/                         # Project documentation
│   ├── ARCHITECTURE.md
│   ├── FREE_FIRST_POLICY.md
│   ├── ENVIRONMENT.md
│   ├── PHASES.md
│   └── API_PROVIDER_MATRIX.md
└── README.md                     # this file
```

## Frontend root (Vercel)

`frontend/`

When importing the repository into Vercel, set **Root Directory** to `frontend`.
Framework is auto-detected as Next.js. Build command is `npm run build`.

## Public API surface (Phase 1.D)

| Route                                  | Phase | Notes                                                                                          |
|----------------------------------------|-------|--------------------------------------------------------------------------------------------------|
| `GET /`                                | 0.B   | Home with hero, latest news, analysis, match day banner. Mock data fallback.                       |
| `GET /news/[slug]`                     | 0.B   | News article stub. Reads from `lib/wordpress.ts` → WPGraphQL or mock.                              |
| `GET /match/[slug]`                     | 0.B   | Match hub stub.                                                                                   |
| `GET /league/[slug]`                    | 0.B   | League hub stub.                                                                                  |
| `GET /team/[slug]`                      | 0.B   | Team hub stub.                                                                                    |
| `GET /robots.txt`                       | 0.B   | Static via Next.js MetadataRoute.                                                                  |
| `GET /sitemap.xml`                      | 0.B   | Static via Next.js MetadataRoute (mock data; expands when WordPress ships).                       |
| `GET /api/health`                       | 0.C   | Reports `configured` booleans. Never echoes secrets.                                              |
| `GET /api/revalidate`                   | 0.B   | Webhook from WordPress. Requires `REVALIDATE_SECRET` header. POST only.                            |
| `GET /api/football/competitions`       | 1.C   | Cached 6h. Provider-resolution + quota + retry + cache.                                           |
| `GET /api/football/matches`            | 1.C   | Cached 5m (stale 10m). Query: `provider`, `competition`, `season`.                                  |
| `GET /api/football/standings`          | 1.C   | Cached 10m. Query: `provider`, `competition`.                                                       |
| `GET /api/football/teams`              | 1.C   | Cached 6h. Query: `provider`, `competition`.                                                        |
| `GET /api/football/health`             | 1.C   | Safe diagnostic. Never makes external API calls. Returns booleans only.                              |

All routes are server-only when they touch the provider layer. The frontend
homepage and stub pages render via Next.js with no client-side provider imports.

## Provider support

| Provider           | Role      | Free tier required | Notes                                                                                                  |
|--------------------|-----------|--------------------|---------------------------------------------------------------------------------------------------------|
| football-data.org  | PRIMARY   | yes                | Real client + normalization live in `lib/football/providers/football-data.*`. Returns canonical schema.   |
| api-football (free) | SECONDARY | yes                | Real client + normalization live in `lib/football/providers/api-football.*`. Used only when primary fails/short on quota. |

**Tests do not require keys.** All provider tests run against sanitized
fixtures (`lib/football/providers/__fixtures__/`). Real provider calls are
gated behind `configured = Boolean(process.env.<KEY>)`. When the key is
absent, provider methods return `[]` or `null` and the route handler
returns a 200 envelope with an empty `data` array.

## Environment variables

See `frontend/.env.example` for the canonical schema. Values are
**placeholders only** in the repository — never commit real secrets.

| Variable                    | Scope          | Required for       | Default                  |
|-----------------------------|----------------|--------------------|--------------------------|
| `NEXT_PUBLIC_SITE_URL`      | PUBLIC (browser) | Vercel canonical URL | `https://football-factory.vercel.app` (placeholder) |
| `WORDPRESS_GRAPHQL_URL`     | server         | optional (Phase 9) | unset → mock fallback    |
| `WORDPRESS_REST_URL`        | server         | optional (Phase 9) | unset → mock fallback    |
| `REVALIDATE_SECRET`         | server         | Phase 0.B webhook  | placeholder is treated as unconfigured |
| `FOOTBALL_PROVIDER`         | server         | Phase 1.C          | `football-data.org` (default if unset; values: `football-data.org`, `api-football`) |
| `FOOTBALL_DATA_API_KEY`     | server         | Phase 1.B/C live   | unset → provider returns `[]` |
| `API_FOOTBALL_KEY`          | server         | Phase 1.B/C live   | unset → provider returns `[]` |
| `FOOTBALL_DATA_DAILY_LIMIT` | server         | Phase 1.C quota    | `600`                    |
| `API_FOOTBALL_DAILY_LIMIT`  | server         | Phase 1.C quota    | `100`                    |

`NEXT_PUBLIC_*` variables are the ONLY safe prefix for client-visible env.
Provider keys, REVALIDATE_SECRET and quota limits must NEVER be `NEXT_PUBLIC_*`.

## Caching and quota (Phase 1.C)

- **Cache**: in-memory, per-process, deterministic keys, stale-while-revalidate
  for matches. Replaceable by Redis or Vercel KV without changing the
  `FootballService` or route handlers (out of scope for Phase 1.D).
- **Quota**: in-memory counters per provider, soft (80%) + hard (100%)
  thresholds, env-overridable daily limits. Two Vercel serverless instances
  each allow `daily_limit` requests — acceptable for staging, NOT for
  production scale.

## Local development

```bash
cd frontend
npm install
npm test            # Node test runner with tsx loader
npm run typecheck   # tsc --noEmit
npm run build       # next build
```

`npm run lint` is currently `next lint`, which is deprecated in Next.js 15
and requires interactive setup. ESLint migration is deferred to avoid
introducing compatibility risk mid-Phase-1. Build-internal lint runs as
part of `npm run build`.

## Production caveats

- No realtime / live-score polling. Refresh windows are fixed per
  resource kind (see TTL map in `lib/football/football-service.ts`).
- No paid API plans.
- No scraping. `thscore99.com` is reference-only and not wired in.
- `AUTO_PUBLISH=false` for the editorial pipeline. Phase 2 will introduce
  the AI writer + n8n workflows — Phase 1 does NOT touch content automation.
- Cache and quota are per-process. Production scale requires a shared
  cache layer (Redis / Vercel KV) — out of scope for Phase 1.

## Phase history

- **Phase 0.A** — docs (`docs/`), `.env.example`, `.gitignore` allow-list.
- **Phase 0.B** — Next.js 15 frontend foundation (pages, components, WPGraphQL client).
- **Phase 0.C** — `/api/health` + provider abstraction stubs.
- **Phase 1.A** — competition registry + identity resolution (canonical IDs, alias matching).
- **Phase 1.B** — real provider clients (football-data.org + api-football) + normalization + status mapping + error model + sanitized fixtures.
- **Phase 1.C** — `/api/football/*` routes + cache + quota + retry + orchestration + health diagnostic.
- **Phase 1.D** — documentation consolidation + final security scan + canonical verification + Vercel staging deployment.
