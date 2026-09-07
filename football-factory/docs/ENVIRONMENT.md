# Football Factory — Environment Variables

Status: Phase 0.A — schema documentation. No real values are stored in this repository.

## File layout
- `.env.example` — committed, placeholders only
- `.env.local` — gitignored, real local values
- `.env.production` — gitignored, used by Vercel via dashboard only
- `wp-config.php` constants — set on the WordPress host, not committed

## Frontend — Next.js (Vercel)
Variables consumed by `frontend/`.

| Name | Required | Where set | Purpose |
|------|----------|-----------|---------|
| `NEXT_PUBLIC_SITE_URL` | yes | Vercel dashboard | Canonical site URL used in metadata, sitemap, robots, JSON-LD |
| `WORDPRESS_GRAPHQL_URL` | no | Vercel dashboard | WordPress WPGraphQL endpoint. If missing, frontend falls back to mock data |
| `WORDPRESS_REST_URL` | no | Vercel dashboard | WordPress REST base URL. Reserved for Phase 9 |
| `REVALIDATE_SECRET` | yes (Phase 9) | Vercel dashboard | Shared secret validated on `/api/revalidate` |

`NEXT_PUBLIC_*` variables are exposed to the browser. Never put a secret in `NEXT_PUBLIC_*`.

## Football data providers (Phase 1)
These are consumed by the Football Factory API layer (server-side only — never exposed to the browser).

| Name | Required | Where set | Purpose |
|------|----------|-----------|---------|
| `FOOTBALL_DATA_API_KEY` | yes (Phase 1) | Local `.env.local` / Vercel dashboard | football-data.org API key (primary) |
| `API_FOOTBALL_KEY` | yes (Phase 1) | Local `.env.local` / Vercel dashboard | API-Football key (secondary) |
| `FOOTBALL_PROVIDER_MODE` | no | Local / Vercel | `primary` (default), `secondary`, `mock`, `auto` |

## WordPress host
Set as PHP constants in `wp-config.php` on the WordPress server. NEVER commit real values.

| Name | Required | Purpose |
|------|----------|---------|
| `FF_REVALIDATE_URL` | yes (Phase 9) | Next.js `/api/revalidate` endpoint |
| `FF_REVALIDATE_SECRET` | yes (Phase 9) | Shared secret matching `REVALIDATE_SECRET` on the Next.js side |

## n8n (local)
Credentials live inside n8n's local credential store. The workflows reference credentials by ID, not by raw value. NEVER export credentials into JSON committed to Git.

Variables read by n8n (set in `.env` of the n8n host, NOT in this repo):
- `FF_WPGRAPHQL_URL`
- `FF_WPGRAPHQL_TOKEN`
- `FF_WP_REST_TOKEN`
- `FF_FOOTBALL_DATA_API_KEY`
- `FF_API_FOOTBALL_KEY`

## Quota monitoring
The provider adapters write quota counters to a local file (`./.state/quota.json`) or to n8n state, depending on where the adapter runs. These files MUST be gitignored.

## Secret-rotation policy
- Rotate `REVALIDATE_SECRET` and `FF_REVALIDATE_SECRET` together at the same time
- Rotate provider API keys at least every 90 days
- After rotation, redeploy the frontend and restart n8n workflows

## Pre-commit checklist (NEW contributor)
1. Run `git diff -- .env.example` — placeholders only
2. Run `grep -rE '(sk_live|FB[A-Z0-9]{20,}|AKIA[A-Z0-9]{16,})' .` — must return nothing
3. Confirm `wp-config.php` constants in committed code are placeholders or comments only
4. Confirm no `*.key`, `*.pem`, `*.p12` files in the working tree
