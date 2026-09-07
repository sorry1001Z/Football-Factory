# Football Factory — Free-First Policy

Status: Phase 0.A. This policy governs the entire project lifetime.

## Hard rules
1. NO paid APIs, NO paid hosting, NO paid SaaS in any phase unless explicitly approved.
2. NO purchases of any kind (API keys, domains, premium tiers) by the agent.
3. Use open-source, self-hosted or free-tier services only.
4. thscore99.com is reference-only in early phases. It is NOT a production data source until Terms of Service, robots.txt and rights have been reviewed and a written decision is recorded.
5. NO scraping of any website as a production source until Terms/robots/rights have been reviewed.
6. NO Live Score / real-time polling in early phases. Refresh windows are fixed (see below).
7. Real API keys NEVER enter the repository, code, Git history, logs, screenshots or chat. Use `.env.local` (gitignored) and `.env.example` (placeholders only).

## Approved services
- GitHub — free public repository
- Vercel — free Hobby tier for staging. Production scaling must be re-evaluated before launch.
- WordPress — self-hosted, local
- WPGraphQL — free WordPress plugin
- football-data.org — free tier only
- API-Football — free tier only
- n8n — Community Edition / self-hosted, local
- Google Account — free Gmail / Workspace free tier where applicable
- Next.js (open source)
- Football Factory Bridge plugin — written in this repository

## NOT approved
- Any API key that requires a paid plan
- Any CDN upgrade beyond Vercel Hobby
- Any scraping SaaS (Apify, Bright Data, etc.)
- Any AI service that charges per-token above free quota
- Any managed database beyond what local/self-hosted provides
- Any push notification / email service that charges per send above free quota
- Any monitoring service above free tier (statuspage.io, Datadog, Sentry paid, etc.)

## Refresh windows (early phases)
- Fixtures — every 6 hours
- Standings — every 6 to 12 hours
- Results — after scheduled match windows
- Teams — daily or weekly
- News — collected on a controlled schedule, never polled continuously

## Quota discipline
- Every provider adapter MUST report quota usage to a local counter
- Dedup requests by `(resource, params, day)` key
- On quota threshold (≥80%), switch to the secondary provider and emit an alert
- On secondary quota threshold (≥80%), switch to mock fallback and emit a critical alert
- Never call both providers for the same resource in a single cycle

## Secrets handling
- `.env.example` ships placeholders only
- `.env`, `.env.local`, `.env.production`, `.env.development` are gitignored
- WordPress `wp-config.php` constants (`FF_REVALIDATE_URL`, `FF_REvalidate_SECRET`) MUST NOT contain real values in the repository
- Vercel project variables hold real values (set via dashboard, never via commit)
- n8n credentials live inside n8n local storage, NEVER exported to JSON committed to Git

## Review triggers
Before adding ANY new paid service, write a one-paragraph justification to a PR and stop for review. The agent will NOT add paid services on its own.
