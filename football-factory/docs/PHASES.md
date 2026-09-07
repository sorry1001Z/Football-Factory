# Football Factory — Phases

Status: Phase 0.A. Phases are sequential. Each phase ends with a review before the next begins.

## Working rules
- Work one phase at a time. Do NOT build all phases simultaneously.
- After each phase: run tests, report changed files, report commands executed, report failures, provide rollback notes.
- If a major architectural decision is required, STOP for review before continuing.
- Do NOT claim PASS unless tests were actually executed.

## Phase 0 — Foundation
**Goal:** prepare the project foundation before connecting any real API.
**Current sub-phase:** 0.A — Audit + Docs only.
**Deliverables (full Phase 0):**
1. Audit current repository
2. Confirm Next.js version and structure
3. Confirm Vercel compatibility
4. Confirm mock fallback works
5. Confirm WordPress bridge plugin structure
6. Prepare WPGraphQL integration
7. Prepare environment variable schema
8. Create health endpoints
9. Create provider abstraction interfaces
10. Create documentation (this folder)

Required docs:
- ARCHITECTURE.md ✓
- FREE_FIRST_POLICY.md ✓
- ENVIRONMENT.md ✓
- PHASES.md ✓ (this file)
- API_PROVIDER_MATRIX.md ✓

Required env vars (declared, not filled):
- WORDPRESS_GRAPHQL_URL
- WORDPRESS_REST_URL
- WORDPRESS_REVALIDATE_SECRET
- FOOTBALL_DATA_API_KEY
- API_FOOTBALL_KEY
- NEXT_PUBLIC_SITE_URL

## Phase 1 — Football Data Foundation
**Goal:** build a provider-neutral data layer.
- Canonical domain models: Competition, League, Season, Team, Player, Fixture, Match, Standing, Result
- Initial competitions: PL, LaLiga, Bundesliga, Serie A, Ligue 1, UCL, UEL, UECL, FA Cup, Carabao, Copa del Rey, DFB-Pokal, Coppa Italia, Coupe de France
- FootballProvider interface: getCompetitions, getFixtures, getResults, getStandings, getTeams, getMatch
- Implementations: FootballDataProvider, ApiFootballProvider
- Canonical output with provider_id, external_id, canonical_id, fetched_at, provider, data_quality_status
- Local cache, dedup, TTL, quota counter, provider fallback, retry with backoff
- NO real-time polling

## Phase 2 — Source Registry
TIER 1 = official club / league / UEFA / FIFA. TIER 2 = major trusted news. TIER 3 = trusted journalists. TIER 4 = general sports. TIER 5 = social / rumours (never auto-publish).

## Phase 3 — News Collector
RSS + official feeds + public permitted pages + manual test sources. Pipeline: Fetch → Normalize → Extract metadata → Fingerprint → Deduplicate → Story Cluster.

## Phase 4 — Fact Engine
Convert source material into structured facts. Cross-check facts against football APIs, official sources, multiple news sources.

## Phase 5 — Confidence Engine
Official confirmation = very high. Multiple trusted sources agree = increase. Football data confirms = increase. Single rumour = decrease. Conflict = block.
Statuses: VERIFIED, HIGH_CONFIDENCE, REVIEW, CONFLICT, REJECTED.

## Phase 6 — Thai Content Engine
DO NOT fine-tune. Prompt + style architecture only. Inputs: structured facts, football data, source context, Thai Football Style Guide.

## Phase 7 — Content Types
Templates/prompts for: Breaking News, Transfer News, Match Preview, Match Report, Team News, League News, Analysis, Player News, Standings Update.

## Phase 8 — QA
Fact QA, Thai Language QA, Sports Tone QA, SEO QA, Originality QA. Statuses: PASS, REWRITE, REVIEW, BLOCK.
At launch: AUTO_PUBLISH=false. All output to WordPress Draft first.

## Phase 9 — WordPress
Local WordPress initially. WPGraphQL + Football Factory Bridge plugin. CPTs: Team, League, Match, Player, News / Posts.
Expose only normalised data. Support Create Draft, Update Draft, Publish, Taxonomy mapping, Featured image, SEO metadata, Canonical, Related content.

## Phase 10 — Vercel / Next.js
Existing frontend design retained. Homepage spec: Header, Competition menu, Hero (1 large + 2x2), Latest News (2x5), Match Day Banner, Analysis (2x5 with league filters), Competitions (PL, LaLiga, Bundesliga, Serie A, Ligue 1, UCL, UEL, UECL, Domestic cups). NO Live Score.

## Phase 11 — SEO
Hybrid SEO: WordPress (editorial SEO metadata) + Next.js (generateMetadata, canonical, OpenGraph, robots, sitemap, news sitemap, JSON-LD, breadcrumbs). Schema: NewsArticle, SportsEvent, Organization, BreadcrumbList.

## Phase 12 — Revalidation
WordPress Publish → secure webhook → Next.js revalidate → Vercel cache refresh. Only affected routes: /, /news/{slug}, /team/{slug}, /league/{slug}, /match/{slug}.

## Phase 13 — n8n Automation
LOCAL n8n / Community Edition. Workflows: FF_source_collect_v1, FF_story_cluster_v1, FF_fact_extract_v1, FF_fact_verify_v1, FF_content_generate_v1, FF_content_qa_v1, FF_wordpress_draft_v1, FF_football_sync_v1, FF_revalidate_v1.
Every workflow needs version, owner, error path, retry, audit log, dry-run mode.

## Phase 14 — Images
No hotlinking copyrighted news images. Support: owned, open-license, authorised media, AI graphics. Optimise to WebP/AVIF, responsive sizes, lazy load, alt text.

## Phase 15 — Ads
Placeholders only: header banner, in-article, sidebar, Match Day sponsor, league sponsor, AdSense slots. Prevent CLS.

## Phase 16 — Monitoring / Backup
Free / open-source tools. Health checks, API quota monitor, n8n failures, WordPress errors, Vercel errors. Backup: repo, WordPress DB, WordPress uploads, n8n workflows, configuration.

## Phase 17 — Auto Publish
DO NOT ENABLE NOW. Rules only. Initial mode: AUTO_PUBLISH=false, AUTO_DRAFT=true.

## Phase 18 — Production Launch
Build pass, lint pass, typecheck pass, API adapter tests, WordPress integration tests, revalidation test, SEO validation, mobile responsive check, security check.

## Phase 19 — Performance Dashboard
DO THIS LAST. Analytics hooks only. Events: article_view, hero_click, league_click, analysis_click, fixture_click, result_click, standings_click, related_article_click, search_submit, newsletter_signup, ad_impression, ad_click.
