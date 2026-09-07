# Football Factory — Phases

Status: Phase 1.D complete. Phase 2 not yet authorized.
Phases are sequential. Each phase ends with a review before the next begins.

## Working rules
- Work one phase at a time. Do NOT build all phases simultaneously.
- After each phase: run tests, report changed files, report commands
  executed, report failures, provide rollback notes.
- If a major architectural decision is required, STOP for review before
  continuing.
- Do NOT claim PASS unless tests were actually executed.

## Phase 0 — Foundation
**Goal:** prepare the project foundation before connecting any real API.
**Status:** DONE (committed `772fa06`).
**Sub-phases:**
- 0.A — Audit + Docs
- 0.B — Next.js frontend foundation
- 0.C — Health endpoint + provider abstraction stubs

**Required docs (all created):**
- ARCHITECTURE.md
- FREE_FIRST_POLICY.md
- ENVIRONMENT.md
- PHASES.md (this file)
- API_PROVIDER_MATRIX.md

**Env vars declared** (see `frontend/.env.example` for live schema):
- WORDPRESS_GRAPHQL_URL
- WORDPRESS_REST_URL
- REVALIDATE_SECRET
- FOOTBALL_PROVIDER
- FOOTBALL_DATA_API_KEY
- API_FOOTBALL_KEY
- FOOTBALL_DATA_DAILY_LIMIT
- API_FOOTBALL_DAILY_LIMIT
- NEXT_PUBLIC_SITE_URL

## Phase 1 — Football Data Foundation
**Goal:** build a provider-neutral data layer behind thin API routes.

| Sub-phase | Status | Notes                                                                                  |
|-----------|--------|-----------------------------------------------------------------------------------------|
| 1.A       | DONE   | Competition registry (14 entries) + identity resolution. canonical IDs, alias matching. |
| 1.B       | DONE   | football-data.org + api-football clients + normalization + status mapping + error model. 122 tests (incl. fixtures). |
| 1.C       | DONE   | `/api/football/{competitions,matches,standings,teams,health}` + cache + quota + retry + orchestration. 122 tests total. |
| 1.D       | DONE   | Docs consolidation + security scan + canonical verification + git checkpoint + Vercel staging deploy (BLOCKED_BY_AUTH until token supplied). |

**Canonical output shape** — every record carries:
- `provider`
- `external_id`
- `canonical_id`
- `fetched_at`
- `data_quality_status` (`fresh | partial | unverified | unavailable | error | stale | cached | fallback`)

**Operational rules:**
- Local in-memory cache, deterministic keys, stale-while-revalidate for matches.
- Per-provider quota counters with soft (80%) and hard (100%) thresholds; env-overridable daily limits.
- Retry only transient failures (RATE_LIMIT, 5xx, network). 401/403/404/invalid_payload/config are NEVER retried.
- No realtime / live-score polling.
- No scraping. `thscore99.com` is reference-only and not wired in.
- Provider clients override `toJSON()` so secret values never leak via JSON.stringify.

**Public API surface (Phase 1.D):**
- `GET /api/football/competitions` (cached 6h)
- `GET /api/football/matches` (cached 5m; stale 10m)
- `GET /api/football/standings` (cached 10m)
- `GET /api/football/teams` (cached 6h)
- `GET /api/football/health` (safe; never makes external API calls)

## Phase 2 — Source Registry
TIER 1 = official club / league / UEFA / FIFA. TIER 2 = major trusted news. TIER 3 = trusted journalists. TIER 4 = general sports. TIER 5 = social / rumours (never auto-publish).

**NOT STARTED.** Requires explicit user approval.

## Phase 3 — News Collector
RSS + official feeds + public permitted pages + manual test sources. Pipeline: Fetch → Normalize → Extract metadata → Fingerprint → Deduplicate → Story Cluster. **NOT STARTED.**

## Phase 4 — Fact Engine
Convert source material into structured facts. Cross-check facts against football APIs, official sources, multiple news sources. **NOT STARTED.**

## Phase 5 — Confidence Engine
Official confirmation = very high. Multiple trusted sources agree = increase. Football data confirms = increase. Single rumour = decrease. Conflict = block.
Statuses: VERIFIED, HIGH_CONFIDENCE, REVIEW, CONFLICT, REJECTED. **NOT STARTED.**

## Phase 6 — Thai Content Engine
DO NOT fine-tune. Prompt + style architecture only. Inputs: structured facts, football data, source context, Thai Football Style Guide. **NOT STARTED.**

## Phase 7 — Content Types
Templates/prompts for: Breaking News, Transfer News, Match Preview, Match Report, Team News, League News, Analysis, Player News, Standings Update. **NOT STARTED.**

## Phase 8 — QA
Fact QA, Thai Language QA, Sports Tone QA, SEO QA, Originality QA. Statuses: PASS, REWRITE, REVIEW, BLOCK.
At launch: AUTO_PUBLISH=false. All output to WordPress Draft first. **NOT STARTED.**

## Phase 9 — WordPress
Local WordPress initially. WPGraphQL + Football Factory Bridge plugin. CPTs: Team, League, Match, Player, News / Posts.
Expose only normalised data. Support Create Draft, Update Draft, Publish, Taxonomy mapping, Featured image, SEO metadata, Canonical, Related content. **NOT STARTED.**

## Phase 10 — Vercel / Next.js
Existing frontend design retained. Homepage spec: Header, Competition menu, Hero (1 large + 2x2), Latest News (2x5), Match Day Banner, Analysis (2x5 with league filters), Competitions (PL, LaLiga, Bundesliga, Serie A, Ligue 1, UCL, UEL, UECL, Domestic cups). NO Live Score. **PARTIAL** — foundation pages exist with mock data; content wiring happens in Phase 9/11.

## Phase 11 — SEO
Hybrid SEO: WordPress (editorial SEO metadata) + Next.js (generateMetadata, canonical, OpenGraph, robots, sitemap, news sitemap, JSON-LD, breadcrumbs). Schema: NewsArticle, SportsEvent, Organization, BreadcrumbList. **PARTIAL** — basic robots/sitemap/meta exist; full hybrid wiring deferred to Phase 9/11.

## Phase 12 — Revalidation
WordPress Publish → secure webhook → Next.js revalidate → Vercel cache refresh. Only affected routes: /, /news/{slug}, /team/{slug}, /league/{slug}, /match/{slug}.
**PARTIAL** — `/api/revalidate` exists in Phase 0; secure hook handshake enforced via `REVALIDATE_SECRET`.

## Phase 13 — n8n Automation
LOCAL n8n / Community Edition. Workflows: FF_source_collect_v1, FF_story_cluster_v1, FF_fact_extract_v1, FF_fact_verify_v1, FF_content_generate_v1, FF_content_qa_v1, FF_wordpress_draft_v1, FF_football_sync_v1, FF_revalidate_v1.
Every workflow needs version, owner, error path, retry, audit log, dry-run mode. **NOT STARTED.**

## Phase 14 — Images
No hotlinking copyrighted news images. Support: owned, open-license, authorised media, AI graphics. Optimise to WebP/AVIF, responsive sizes, lazy load, alt text. **NOT STARTED.**

## Phase 15 — Ads
Placeholders only: header banner, in-article, sidebar, Match Day sponsor, league sponsor, AdSense slots. Prevent CLS. **NOT STARTED.**

## Phase 16 — Monitoring / Backup
Free / open-source tools. Health checks, API quota monitor, n8n failures, WordPress errors, Vercel errors. Backup: repo, WordPress DB, WordPress uploads, n8n workflows, configuration. **NOT STARTED.**

## Phase 17 — Auto Publish
DO NOT ENABLE NOW. Rules only. Initial mode: AUTO_PUBLISH=false, AUTO_DRAFT=true. **NOT STARTED.**

## Phase 18 — Production Launch
Build pass, lint pass, typecheck pass, API adapter tests, WordPress integration tests, revalidation test, SEO validation, mobile responsive check, security check. **NOT STARTED** — Phase 1.D covers the build/typecheck/security subset.

## Phase 19 — Performance Dashboard
DO THIS LAST. Analytics hooks only. Events: article_view, hero_click, league_click, analysis_click, fixture_click, result_click, standings_click, related_article_click, search_submit, newsletter_signup, ad_impression, ad_click. **NOT STARTED.**
