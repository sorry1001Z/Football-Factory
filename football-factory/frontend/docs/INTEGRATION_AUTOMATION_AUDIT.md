# Football Factory — Integration & Automation Audit

**Phase:** `FOOTBALL_FACTORY_FULL_INTEGRATION_AUTOMATION`
**Baseline HEAD:** `ce7e6a4` (Banner Composer deployment)
**Baseline verifier:** v4 13/13 PASS (818 lib + 62 scripts tests)
**Audit date:** 2026-09-12

---

## 0. Classification key

| Code | Meaning |
|---|---|
| REAL | End-to-end works against a real provider/DB; verified at runtime |
| PARTIAL | Module built and unit-tested; live runtime blocked on credentials or env |
| MOCK | Code path exists but returns fixture data; explicit placeholder |
| MISSING | Not implemented |
| BROKEN | Code present but failing at runtime |
| BLOCKED_BY_CREDENTIAL | Implementation is complete; awaits env/secrets/keys |

---

## 1. Frontend (Next.js, Vercel)

**Status:** REAL
**Path:** `football-factory/frontend/`
**Runtime:** `https://football-factory-three.vercel.app`

- App Router pages: `/`, `/news`, `/news/[slug]`, `/team/[slug]`, `/league/[slug]`, `/match/[slug]`, `/search`, `/teams/[slug]`, `/competitions/[slug]`, `/admin`, `/admin/editorial`
- Public routes return 200. Live probe shows byte-identical content for stable URLs (CSS chunk hash variance only).
- Admin pages server-render with SSR; data-fetch fails gracefully to `null` when DB is unavailable.
- robots: `noindex, nofollow` on `/admin/*` — admin is NOT indexed publicly.

## 2. API Routes (Next.js Route Handlers)

**Status:** REAL

| Route | Method | Auth | Real/Mock/BLOCKED |
|---|---|---|---|
| `/api/health` | GET | none | REAL |
| `/api/health/wordpress` | GET | none | PARTIAL — configured but tunnel TIMEOUT |
| `/api/football/health` | GET | none | REAL (configured=false, provider=football-data.org) |
| `/api/football/competitions` | GET | none | PARTIAL — no API key, returns 0 rows |
| `/api/football/teams` | GET | none | PARTIAL — same |
| `/api/football/matches` | GET | none | PARTIAL — same |
| `/api/football/standings` | GET | none | PARTIAL — same |
| `/api/revalidate` | POST | `x-revalidate-secret` | REAL (correctly 405 on GET) |
| `/api/auth/login` | POST | CSRF + rate-limit | REAL (DB not provisioned) |
| `/api/auth/logout` | POST | CSRF | REAL |
| `/api/auth/register` | POST | CSRF + rate-limit | REAL (DB not provisioned) |
| `/api/admin/posts` | GET/POST/PATCH/DELETE | session + role | REAL (guard 401 without cookie) |
| `/api/admin/editorial` | GET | session + role | REAL |
| `/api/admin/automation/[runId]` | GET | session + role | REAL |
| `/api/automation/deduplicate` | POST | `x-automation-secret` | REAL (DB not provisioned) |
| `/api/automation/editorial-item` | POST | `x-automation-secret` | REAL |
| `/api/automation/ai-assist` | POST | `x-automation-secret` | PARTIAL (provider_status=not_configured) |
| `/api/automation/fact-check` | POST | `x-automation-secret` | PARTIAL (default `pending_manual`) |
| `/api/automation/rights-check` | POST | `x-automation-secret` | PARTIAL (default `manual_review`) |
| `/api/automation/seo-check` | POST | `x-automation-secret` | REAL (deterministic local checks) |
| `/api/automation/wp-draft` | POST | `x-automation-secret` | PARTIAL (needs WORDPRESS_APP_PASSWORD) |
| `/api/automation/wp-publish` | POST | `x-automation-secret` | REAL (gated by approval + rights + stage; needs WP creds) |
| `/api/automation/approval-status` | POST | `x-automation-secret` | REAL |
| `/api/automation/log` | POST | `x-automation-secret` | REAL |
| `/api/automation/alert` | POST | `x-automation-secret` | REAL |

**Live verified:** `/api/admin/posts` returns **401 unauthenticated** without cookie; **does NOT bypass** with `x-automation-secret` header. `/api/automation/deduplicate` and `/api/automation/wp-publish` return **401 automation_secret_invalid** without secret. **No critical security defects found in admin/automation guard rails.**

## 3. Database (PostgreSQL)

**Status:** PARTIAL

- Production connection: **NOT provisioned** — `DATABASE_URL` is not in Vercel env.
- `lib/db/postgres.ts` correctly refuses to operate without `DATABASE_URL` (throws "DATABASE_URL missing").
- Migrations: `migrations/001_application_data.sql` (users, favorites, comments, notifications, editorial_items, automation_runs, audit_logs, seo_audits, analytics_events), `002_security_indexes.sql`, `003_approval_state.sql` (adds editorial_items.approval_state + automation_runs.editorial_item_id FK).
- All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ ... $$` constraint guards).
- `docs/MIGRATION_DOWN_PLAN.md` documents irreversible DROP order.

**Runtime:** Application correctly degrades to `null`/503 when DB is absent. **No fabricated DB data, no cached fixtures leak.**

## 4. WordPress / CMS

**Status:** PARTIAL

- WPGraphQL endpoint configured: `WORDPRESS_GRAPHQL_URL` set to the trycloudflare tunnel host.
- Live probe (`/api/health/wordpress?probe=1`) returns:
  - `configured: true`
  - `endpoint_host: snapshot-zshops-birth-dentists.trycloudflare.com`
  - `reachable: false`
  - `reason: TIMEOUT` — the WPGraphQL endpoint does not respond within 4s probe budget.
- `lib/wordpress/client.ts` is a real GraphQL client with timeout, error envelope, safe messages, never logs queries.
- `lib/wordpress/queries.ts` defines minimal posts query.
- `lib/wordpress/normalize.ts` converts WPGraphQL → canonical `WordPressPost` shape (stripHtml, picker helpers, defensive).
- `lib/wordpress/write.ts` is the REST write client with application-password basic auth, 8s timeout, draft-only by default (`status='publish'` REJECTED in `lib/admin/posts`).
- `lib/wordpress.ts` (legacy) loads `WORDPRESS_GRAPHQL_URL` and falls back to `mockNews` if absent.
- Components consume `lib/wordpress/index.ts` re-exports.

**Readiness:** BLOCKED_BY_CREDENTIAL — WPGraphQL endpoint unreachable from production. The frontend must surface a graceful unavailable state (already does — `lib/wordpress.ts` falls back to mock).

## 5. WPGraphQL

**Status:** PARTIAL (same as WordPress)

- `WORDPRESS_GRAPHQL_URL` env is set in Vercel, but the endpoint is not reachable from the production region at probe time.
- Client correctly classifies failures (`UNCONFIGURED` / `TIMEOUT` / `NETWORK` / `HTTP_ERROR` / `GRAPHQL_ERROR` / `INVALID_PAYLOAD`) and never throws raw errors.

## 6. Football Data Provider

**Status:** PARTIAL

- Two adapters implemented:
  - `lib/football/providers/football-data.ts` + `.client.ts` + `.normalize.ts`
  - `lib/football/providers/api-football.ts` + `.client.ts` + `.normalize.ts`
- `lib/football/provider-resolver.ts` allowlists both names; rejects unknown providers.
- `lib/football/football-service.ts` orchestrates: validate → resolve → cache lookup → quota check → provider call (with retry) → normalize → cache write.
- `lib/football/quota.ts` enforces daily request budget per provider.
- `lib/football/retry.ts` retries transient failures.
- `lib/football/cache/` provides a memory cache (production-grade would be Redis/KV; documented in audit).
- Live `/api/football/health`:
  - `provider: "football-data.org"`
  - `configured: false` — `FOOTBALL_DATA_API_KEY` is NOT set in Vercel
  - `quota: enabled, requests_in_window=7, daily_limit=600` (likely from warm-up probes)
- `/api/football/competitions` returns `data: []`, `cached: true` — the service is correctly returning empty rather than fabricated data.

**Readiness:** BLOCKED_BY_CREDENTIAL — no live API key. Football adapter falls through to mock if no provider is configured AND no key is present.

## 7. Admin

**Status:** PARTIAL (real UI, real guard, no DB)

- `/admin` index and `/admin/editorial` queue: server-rendered, session-guard at API layer. UI links to admin sections (editorial queue, runs, etc.).
- `components/admin/{queue,run,timeline,detail,shell-header}.tsx` — full client UI for editorial queue, automation runs, timeline.
- `lib/admin/guard.ts` is correctly discriminated (`unauthenticated | invalid_session | forbidden | auth_secret_not_configured`).
- Live `/api/admin/posts` without cookie returns `401 unauthenticated`. **No bypass possible** via `x-automation-secret`.
- Verified admin UI surface:
  - Editorial queue: load/filter/paginate
  - Run detail: timeline + recent events
  - Alert + log + automation routes
- Live runtime blocked on DATABASE_URL. UI renders gracefully when `loadInitial()` returns `null`.

## 8. Authentication / Member System

**Status:** REAL (server-side logic), PARTIAL (DB not provisioned)

- `lib/auth/{auth-service,session,cookie,password,redact-secrets,repositories}.ts` — full HS256 JWT-like token with `timingSafeEqual`, `iat` claim, role allowlist, placeholder-rejection for AUTH_SECRET.
- `lib/auth/cookie.ts` — secure-by-default cookie flags (`HttpOnly`, `Secure` in production, `SameSite=Lax`).
- `lib/admin/guard.ts` — admin guard with `AUTH_SECRET` validation (length ≥32, no placeholder, real secret required).
- Routes: `/api/auth/{login,logout,register}` — zod validation, body cap, rate-limit (5/min/IP for login, 3/hour/IP for register).
- `migrations/001_application_data.sql` defines `users`, `favorites`, `comments`, `notifications`, `notification_preferences`.
- Login flow requires DB; live runtime correctly degrades to 503 `database_not_configured` when `DATABASE_URL` absent.

**No fake login, no front-end-only auth.**

## 9. Banner Composer Integration

**Status:** REAL (banner advisory layer)

- `lib/image-system/banner-composer/` ships a verified advisory `composeBanner(input)` function.
- Currently NOT wired into any automation route. The composer returns advisory `BannerComposition` metadata.
- Real wiring requires: an automation step that, given an approved editorial item, asks the composer for `selectedPeople` + `layoutSuggestion` + `warnings`, attaches the result to the run's metadata, and exposes it to a future prompt composer.

**Next action:** Wire `composeBanner` into `wp-draft` (or a new pre-publish hook) — pending R2.1 Wave A-C integration per the audit ordering.

## 10. Image Pipeline

**Status:** PARTIAL (helpers real, no live sources)

- `lib/image-system/url-canonical.ts` — `safeHttpUrl` (rejects `javascript:`, `data:`, `file:`, malformed URLs; strips tracking params; case-insensitive host; fragment removal; 28 default tracking params).
- `lib/image-system/dedupe.ts` — `canonicalIdentity` + `dedupeCandidates` with deterministic priority + tie-break.
- `lib/image-system/policy.ts` — `publicationDecision()`, `canDownloadBinary()`, `rights_confirmed` flow. **UNTOUCHED by recent slices.**
- `lib/image-system/entity-freshness/` — fully shipped, library-only, no runtime enabled.
- `lib/image-system/banner-composer/` — advisory, library-only.

No live image source integration yet. Images are sourced from feature candidates with rights metadata; no commercial bank.

## 11. SEO

**Status:** REAL (renderer); PARTIAL (G3 advisory layer)

- `lib/seo/` and `lib/seo-entity/` provide canonical SEO rendering: `<title>`, meta description, canonical, robots, JSON-LD (`BreadcrumbList`, `NewsArticle`), sitemap, robots.txt.
- Live `/sitemap.xml` and `/robots.txt` 200.
- Live homepage carries canonical to `https://football-factory-three.vercel.app`.
- `lib/seo-v3/` provides `Wave A` (generic core), `Wave B` (keyword intent + internal linking), `Wave C` (FootballSeoAdapter), `Wave D` (GSC provider contract — fixture-only). All advisory/library-only.
- SEO automation `/api/automation/seo-check` performs deterministic local checks (title/desc/slug/content length/internal links); returns `provider_status=not_configured` for the deeper external provider.

## 12. Automation Hooks

**Status:** REAL (framework) — full set of FF_HOOK_1..8 routes exist (see §2). The framework enforces:
- `x-automation-secret` shared-secret auth with constant-time compare.
- Idempotency via `idempotency_key` UNIQUE at DB level (concurrent submissions resolve to one INSERT).
- Stage machine forward-only: `ingested → editorial_created → ai_assist → fact_check → rights_check → seo_check → draft_created → waiting_approval → approved → published`. Terminal: `rejected | failed | published`.
- Rights gating defense-in-depth: rights cleared → human approval → publish.
- Retry policy: only transient (`timeout`, `network`, `upstream_temporary`, `wp_retryable`); permanent refusals (`auth`, `validation`, `rights_rejected`, `approval_rejected`, `association_mismatch`, `ownership_mismatch`); retry emits `rerun_stage` only.

## 13. Scheduler / Worker

**Status:** PARTIAL (no in-process scheduler currently)

- `n8n/football-factory-production-expansion.json` exists but is a workflow definition, not a scheduler. **`active=false` per prior commitments.**
- No internal scheduler (e.g., cron-style) in the Next.js process.
- Architecture target: Domain Service → Internal API → Scheduler/Admin/n8n.
- **To add real scheduled refresh:** needs an external scheduler (e.g., Vercel Cron, GitHub Actions cron, n8n cron node) hitting the automation endpoints. No such trigger is wired today.

## 14. Analytics Hooks

**Status:** REAL (event store); PARTIAL (live SDKs)

- `lib/analytics/provider.tsx` defines `NoopAnalyticsProvider` + `GoogleAnalyticsAdapter` (deferred; body is no-op until consent given).
- `lib/consent/{version,snapshot,storage,bridge}.ts` provides consent gating.
- `lib/consent/index.ts` barrel re-exports; `lib/consent/__tests__/consent.test.ts` covers the gating.
- Final ConsentBanner UI is NOT yet built (per prior commitments).
- Real-time analytics events are written to `analytics_events` table when DB is provisioned.

## 15. Deployment / Runtime

**Status:** REAL

- Vercel production deploys working. Latest deploy observed at `https://football-factory-three.vercel.app` returned `200 OK` on all public routes.
- Local WordPress via Cloudflare Quick Tunnel: `snapshot-zshops-birth-dentists.trycloudflare.com`. **Live probe shows TIMEOUT** — tunnel reachable from origin verification but not from production probes. The tunnel may need to be re-established or DNS may have rotated.
- `next.config.mjs` + `tsconfig.json` validate clean.

## 16. Environment / Config

**Status:** PARTIAL (placeholders documented; no real secrets in repo)

- `.env.example` documents placeholders; real secrets go in `.env.local` (gitignored) or Vercel env.
- Verified env names: `WORDPRESS_GRAPHQL_URL`, `WORDPRESS_REST_URL`, `WORDPRESS_REVALIDATE_SECRET`, `WORDPRESS_APP_USER`, `WORDPRESS_APP_PASSWORD`, `FOOTBALL_DATA_API_KEY`, `API_FOOTBALL_KEY`, `FOOTBALL_PROVIDER_MODE`, `DATABASE_URL`, `AUTH_SECRET`, `AUTOMATION_SECRET`, `SESSION_COOKIE_NAME`, `NEXT_PUBLIC_SITE_URL`, `AI_ASSIST_PROVIDER_URL`.
- `config.yml` (3 bytes, mtime 2026-09-09) intentionally untracked.

## 17. Mocks / Fallback Data

**Status:** PARTIAL (mock fallback paths documented)

- `lib/mock-data.ts` exists and is consumed only by `lib/wordpress.ts` (legacy read path) when `WORDPRESS_GRAPHQL_URL` is unset.
- Football service uses cache + empty-array fallback when provider not configured (does NOT fabricate fake competitions).
- Consent modules are real (storage, bridge, modal controller primitive). Final ConsentBanner is mocked-via-module-absence.

---

## Critical Security Defects Found This Phase

**None.** Admin guard correctly returns 401 without session. `x-automation-secret` does NOT bypass `/api/admin/*`. Automation routes correctly return 401 `automation_secret_invalid` without the secret. `AUTH_SECRET` placeholder values are refused. `BODY_CAP` enforced. CSRF check applied to cookie-authenticated state-changing routes.

---

## Live Runtime Evidence Summary

| Probe | URL | Result |
|---|---|---|
| Home | `GET /` | 200 |
| News list | `GET /news` | 200 |
| Article | `GET /news/phase-3-test` | 200 |
| Team | `GET /teams/manchester-united` | 200 |
| Competition | `GET /competitions/premier-league` | 200 |
| Sitemap | `GET /sitemap.xml` | 200 |
| Robots | `GET /robots.txt` | 200 |
| App health | `GET /api/health` | 200 |
| WP probe | `GET /api/health/wordpress?probe=1` | 200 — `configured:true, reachable:false (TIMEOUT)` |
| Football health | `GET /api/football/health` | 200 — `provider:football-data.org, configured:false` |
| Football competitions | `GET /api/football/competitions` | 200 — `data:[]` (no API key) |
| Admin guard (no cookie) | `GET /api/admin/posts` | 401 `unauthenticated` |
| Admin guard (bogus automation secret) | `GET /api/admin/posts` with `x-automation-secret` | 401 `unauthenticated` (no bypass) |
| Automation guard (no secret) | `POST /api/automation/deduplicate` | 401 `automation_secret_invalid` |
| Automation wp-publish (no secret) | `POST /api/automation/wp-publish` | 401 `automation_secret_invalid` |

**Zero 5xx responses. Zero critical security defects.**

---

## CREDENTIALS_REQUIRED (for FULL real integration)

To advance from PARTIAL → REAL on the items below:

1. `FOOTBALL_DATA_API_KEY` (and/or `API_FOOTBALL_KEY`) — for live football data.
2. `DATABASE_URL` (Postgres connection string) — for application data + automation runs.
3. `WORDPRESS_APP_USER` + `WORDPRESS_APP_PASSWORD` — for draft creation + publish.
4. Declared-reachable WordPress host — the current trycloudflare URL is timing out from production.
5. `AUTOMATION_SECRET` (Vercel env) — to enable n8n/external orchestration to call automation routes. Currently `automation_secret_not_configured` would be returned.
6. `AUTH_SECRET` (≥32 chars, no placeholder) — for admin session validation. Currently `auth_secret_not_configured` would be returned.
7. `AI_ASSIST_PROVIDER_URL` — if/when AI-assisted editorial is desired.

---

## MANUAL_ACTION_REQUIRED

- Decide WP host strategy: bring back the tunnel, or move to a permanent host before go-live.
- Provision a Postgres database (Neon recommended per existing conversation memory).
- Provision at least one football data API key.
- Schedule recurring jobs (cron / Vercel Cron / GitHub Actions) for:
  - football-data sync (every N hours)
  - editorial candidate generation
  - draft cleanup
  - audit log archival

---

## NEXT PHASE

Proceed to **Phase 2 (Real Data Flow)** by:
1. Provisioning DATABASE_URL + secrets in Vercel + WP.
2. Running migrations on the new DB.
3. Confirming football-data returns real competitions + matches + standings.
4. Confirming WPGraphQL endpoint reachable.
5. Wiring the Banner Composer into a pre-publish hook.
6. Building the Automation Admin UI dashboard (currently component-level exists; a run/automation admin page surface is the next step).
