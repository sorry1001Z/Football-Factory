# Football Factory — Architecture

Status: Phase 0.A — foundation docs only. No code changes in this phase.

## Purpose
Football Factory is a free-first Thai football media site built on a headless stack. Visitors must always read content through the public Next.js frontend. Editorial work happens in WordPress. Football data is normalised behind a provider abstraction so we are never locked to a single paid vendor.

## High-level flow
```
Visitors
  ↓
Vercel CDN
  ↓
Next.js (App Router, TypeScript, React 19, Next 15)
  ↓
WPGraphQL / WordPress REST
  ↓
Local WordPress (headless CMS)
  ↓
Football Factory Bridge plugin (CPTs, revalidate webhook)
  ↓
Football Factory API layer
  ↓
Data / Content / Automation (n8n local)
```

## Boundaries
- WordPress is the editorial CMS. It owns entity management, SEO fields and admin-only workflows. It is NOT served directly to visitors.
- WPGraphQL is the public content contract between WordPress and Next.js.
- Next.js is the public surface: pages, metadata, canonical, schema, sitemap, internal links, ISR cache, revalidation.
- Vercel hosts the frontend and exposes the revalidate endpoint.
- Football Factory API layer normalises football data, resolves identities, controls freshness and tracks provider quotas.
- n8n orchestrates ingestion, enrichment, QA and publication support. n8n MUST NOT write to the WordPress database directly — it uses the WordPress REST/GraphQL endpoints with proper credentials.
- n8n runs locally (Community Edition / self-hosted). Free tier only.

## Data sources — priority order
1. football-data.org — PRIMARY provider
2. API-Football (free tier) — SECONDARY provider
3. Fallback to the other provider on failure
4. Mocks during development
5. thscore99.com — reference / cross-check only in early phases. NOT a production source until Terms, robots.txt and rights have been reviewed.

## Why headless
- Public traffic scales independently of WordPress
- Next.js controls SEO surface 100% (canonical, JSON-LD, sitemap)
- Editorial team keeps the WordPress workflow they already know
- Football data layer stays portable between providers

## Repo layout (this repository)
```
football-factory/
  frontend/          Next.js app (App Router)
  wordpress-plugin/  Bridge plugin (PHP, single file)
  docs/              This folder
  .env.example       Environment schema (no real values)
```

## What lives where
- Pages, metadata, sitemap, robots → Next.js (frontend/)
- Posts, CPTs, taxonomies, SEO fields, revalidate trigger → WordPress
- Football canonical schema, provider adapters, cache, quota → Football Factory API (Phase 1)
- News collector, fact engine, confidence engine, Thai content engine → n8n + Workers (Phase 2+)

## Non-negotiable invariants
1. Visitors never hit the WordPress origin directly
2. Real API keys never enter code, Git history or logs
3. Provider payloads are never returned to the frontend raw — always through canonical Football Factory schema
4. AUTO_PUBLISH stays false until accuracy metrics prove it is safe
5. Every workflow has version, owner, error path, retry, audit log and dry-run mode
