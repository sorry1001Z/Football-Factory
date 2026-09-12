# Football Factory — Integration Status

**Phase:** `FOOTBALL_FACTORY_FULL_INTEGRATION_AUTOMATION`
**Generated:** 2026-09-12

Module-level status snapshot. See `INTEGRATION_AUTOMATION_AUDIT.md` for full audit.

| Module | Status | Real / Mock / Blocked |
|---|---|---|
| Frontend (Next.js, Vercel) | REAL | Production live at football-factory-three.vercel.app |
| API routes (server) | REAL | 22 routes implemented; auth guards enforced |
| Database (Postgres) | PARTIAL | Migrations ready; `DATABASE_URL` not provisioned |
| WordPress (CMS) | PARTIAL | Endpoint configured; tunnel TIMEOUT |
| WPGraphQL | PARTIAL | Same as WordPress |
| Football Data Provider | PARTIAL | Adapter real; `FOOTBALL_DATA_API_KEY` not provisioned |
| Admin | PARTIAL | UI real; guard 401 enforced; DB not provisioned |
| Auth / Member | PARTIAL | HS256 + cookie + rate-limit real; DB not provisioned |
| Banner Composer | REAL | Advisory library-only; not yet wired to automation |
| Image Pipeline | PARTIAL | URL canonicalize + dedupe + freshness + banner advisory; no live source |
| SEO | REAL | Renderer real; V3 advisory library-only |
| Automation Hooks | REAL | FF_HOOK_1..8 routes implemented; admin-gated |
| Scheduler / Worker | PARTIAL | No in-process scheduler; n8n workflow exists (`active=false`) |
| Analytics Hooks | PARTIAL | Event store real; UI ConsentBanner not built |
| Deployment / Runtime | REAL | Vercel live |
| Env / Config | PARTIAL | Placeholders documented; no real secrets in repo |
| Mocks / Fallback | PARTIAL | Documented fallback paths (no fabricated data) |

## Critical Security Defects

**None found in this phase.** Admin guard returns 401 without cookie; `x-automation-secret` does NOT bypass admin routes; automation routes refuse without secret; AUTH_SECRET placeholder values refused.

## Live Runtime Evidence

- Public routes (home, news, article, team, competition, sitemap, robots, /api/health, /api/health/wordpress, /api/football/health, /api/football/{competitions,teams,matches,standings}): all 200.
- Admin guard (no cookie): 401 `unauthenticated`.
- Admin guard (bogus `x-automation-secret` header): 401 `unauthenticated` — **no bypass**.
- Automation route (no secret): 401 `automation_secret_invalid`.
- WP probe: `configured:true, reachable:false, reason:TIMEOUT` from production region.
- Football health: `provider:football-data.org, configured:false`.

## Credentials Required (BLOCKED_BY_CREDENTIAL)

1. `FOOTBALL_DATA_API_KEY` — for live football data.
2. `DATABASE_URL` — for application data + automation runs.
3. `WORDPRESS_APP_USER` + `WORDPRESS_APP_PASSWORD` — for draft/publish.
4. Reachable WordPress host — current trycloudflare URL is TIMEOUT.
5. `AUTOMATION_SECRET` — for orchestrators (n8n, cron) to call automation routes.
6. `AUTH_SECRET` (≥32 chars, no placeholder) — for admin session validation.
7. `AI_ASSIST_PROVIDER_URL` (optional) — for future AI-assisted editorial.

## MANUAL_ACTION_REQUIRED

- Decide WP host strategy (re-establish tunnel / permanent host).
- Provision Postgres (Neon) + run migrations 001, 002, 003.
- Provision at least one football-data API key.
- Schedule recurring jobs for football-data sync, editorial candidate generation, draft cleanup.
- Build final ConsentBanner UI (currently library-only).

## Decision / Status Flags

- `PRE_GO_LIVE_SECURITY_GATE`: PENDING
- `GO_LIVE_ALLOWED`: false
- n8n: `active=false`
- `config.yml`: untouched
- DB: not provisioned
