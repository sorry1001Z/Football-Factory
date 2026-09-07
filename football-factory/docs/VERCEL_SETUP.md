# Football Factory — Vercel Configuration

This document is the **source of truth for Vercel setup**. Apply these
settings via the Vercel dashboard (Project Settings). Tokens, deploy
hooks and live deploys are NOT handled by the agent.

## Project

| Field              | Value                                                      |
|--------------------|-------------------------------------------------------------|
| Repository         | `sorry1001Z/Football-Factory`                               |
| Project name       | `football-factory`                                          |
| Framework          | `Next.js` (auto-detected)                                   |
| Root Directory     | `frontend`                                                  |
| Install command    | `npm install` (default)                                     |
| Build command      | `npm run build` (default; already in `frontend/package.json`) |
| Output             | Next.js default                                             |
| Node version       | 20.x or higher (matches Next.js 15 requirement)             |
| Region             | HKG1 or SIN1 (closest to Thai visitors)                    |

## Vercel env vars (Production + Preview)

Add via **Project Settings → Environment Variables**. **Never commit
real values to Git.**

| Variable                       | Environments      | Value (placeholder)                                    |
|--------------------------------|--------------------|----------------------------------------------------------|
| `NEXT_PUBLIC_SITE_URL`         | Production, Preview | `https://football-factory.vercel.app` (set after first deploy to actual Vercel URL) |
| `WORDPRESS_GRAPHQL_URL`        | (skip for now)     | Phase 9 — local WPGraphQL endpoint                      |
| `WORDPRESS_REST_URL`           | (skip for now)     | Phase 9 — local WP REST endpoint                         |
| `REVALIDATE_SECRET`            | Production, Preview | `replace-with-a-long-random-secret` (Phase 9; unconfigured for now) |
| `FOOTBALL_PROVIDER`            | Production, Preview | `football-data.org`                                     |
| `FOOTBALL_DATA_API_KEY`        | Production, Preview | (unset → provider returns `[]`)                          |
| `API_FOOTBALL_KEY`             | Production, Preview | (unset → provider returns `[]`)                          |
| `FOOTBALL_DATA_DAILY_LIMIT`     | Production, Preview | `600`                                                    |
| `API_FOOTBALL_DAILY_LIMIT`     | Production, Preview | `100`                                                    |

**Server-only** (must NOT be `NEXT_PUBLIC_*`):
- `REVALIDATE_SECRET`
- `FOOTBALL_PROVIDER`
- `FOOTBALL_DATA_API_KEY`
- `API_FOOTBALL_KEY`
- `FOOTBALL_DATA_DAILY_LIMIT`
- `API_FOOTBALL_DAILY_LIMIT`

**Public** (must be `NEXT_PUBLIC_*` if used in browser):
- `NEXT_PUBLIC_SITE_URL`

## Auto-deploy

- Production Branch = `main`
- Every push to `main` triggers a Production build.
- Pull requests get Preview deployments automatically.

## First deploy steps (manual, performed by user)

1. Open https://vercel.com/new.
2. Import `sorry1001Z/Football-Factory`.
3. Set **Root Directory** = `frontend`.
4. Confirm Build Command = `npm run build`.
5. Add env vars per the table above (Production + Preview).
6. Click **Deploy**.
7. Wait for the build to finish.
8. Copy the canonical URL (e.g. `https://football-factory-xxx.vercel.app`).
9. Set `NEXT_PUBLIC_SITE_URL` to that URL and redeploy.

## Smoke-test checklist (after deploy)

Without provider keys set, the deployed site should:

| Route                            | Expected                                              |
|----------------------------------|--------------------------------------------------------|
| `GET /`                          | Renders homepage with mock data                       |
| `GET /robots.txt`                | Returns the static robots file                        |
| `GET /sitemap.xml`               | Returns the static sitemap                            |
| `GET /api/health`                | 200 with safe shape (configured=false)                |
| `GET /api/football/health`       | 200 with safe shape (provider=football-data.org, configured=false) |
| `GET /api/football/competitions` | 200 with `{ ok:true, data:[], meta:{...} }` (empty data because provider unconfigured) |
| `GET /api/football/matches`      | 200 with empty data                                   |
| `GET /api/football/standings`    | 200 with empty data                                   |
| `GET /api/football/teams`        | 200 with empty data                                   |

If any route returns a 500, copy the deployment logs and report them
back to the agent. The free-tier deploy should NOT require any provider
keys to render these endpoints.

## Vercel token policy

The agent never holds a long-lived Vercel token. The free-tier deploy
is performed by the user via the dashboard. Project-scoped deploy
tokens, if used, are stored in `.env.local` only and **never pasted in
chat** (per project security policy).

## Blockers on agent-side deploy

The agent cannot complete Vercel authentication from this sandboxed
session (the agent's browser does not have access to the user's
personal Edge / Chrome session). The agent is therefore limited to:
- preparing build artefacts and `next.config.mjs`
- writing the env-var schema
- documenting the deploy checklist

Vercel deploy status: **BLOCKED_BY_AUTH** until the user performs the
manual steps above.
