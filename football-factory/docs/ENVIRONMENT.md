# Football Factory — Environment Variables

Status: Phase 1.D — schema documented for production-shaped config.
No real values are stored in this repository. `frontend/.env.example`
contains placeholders only.

## File layout

| File                | Committed? | Purpose                                                                       |
|---------------------|------------|--------------------------------------------------------------------------------|
| `.env.example`      | yes        | Placeholder schema. Public reference for what the app reads.                    |
| `.env.local`        | gitignored | Real local values (developer only). Never committed.                            |
| `.env.production`   | gitignored | Used by Vercel ONLY via dashboard env vars. Never committed.                    |
| `wp-config.php`     | host-only  | WordPress-side constants. Never committed.                                      |
| n8n credentials     | host-only  | Stored in n8n's local credential store. Never committed.                         |

## Frontend — Next.js (Vercel)

Variables consumed by `frontend/`. Server-only unless explicitly marked
`NEXT_PUBLIC_*` (browser-visible).

| Name                       | Scope          | Required        | Purpose / Default                                                                 |
|----------------------------|----------------|------------------|------------------------------------------------------------------------------------|
| `NEXT_PUBLIC_SITE_URL`     | PUBLIC         | yes              | Canonical site URL used in metadata, sitemap, robots, JSON-LD. Placeholder: `https://football-factory.vercel.app`. |
| `WORDPRESS_GRAPHQL_URL`    | server         | optional (P9)    | WordPress WPGraphQL endpoint. Missing → mock data fallback.                        |
| `WORDPRESS_REST_URL`       | server         | optional (P9)    | WordPress REST base URL. Reserved for Phase 9.                                    |
| `REVALIDATE_SECRET`        | server         | yes (Phase 9)    | Shared secret validated on `/api/revalidate`. Empty/placeholder = unconfigured.    |
| `FOOTBALL_PROVIDER`        | server         | no (Phase 1.C)   | Default provider name. `football-data.org` (default) or `api-football`.            |
| `FOOTBALL_DATA_API_KEY`    | server         | no (Phase 1.B/C) | football-data.org key. Unset → provider returns `[]`.                              |
| `API_FOOTBALL_KEY`         | server         | no (Phase 1.B/C) | API-Football key. Unset → provider returns `[]`.                                   |
| `FOOTBALL_DATA_DAILY_LIMIT`| server         | no (Phase 1.C)   | Quota override. Default `600`.                                                    |
| `API_FOOTBALL_DAILY_LIMIT` | server         | no (Phase 1.C)   | Quota override. Default `100`.                                                    |

**Hard rule:** `NEXT_PUBLIC_*` is the ONLY safe prefix for browser-visible
environment variables. Provider keys, `REVALIDATE_SECRET` and quota limits
must NEVER be `NEXT_PUBLIC_*`.

## Quota monitoring

The provider adapters hold quota counters in process memory in Phase 1.C.
Production scale requires Redis or Vercel KV (deferred). These files MUST
be gitignored if persisted:

- `./.state/quota.json` (local-only)
- `./.state/cache/` (local-only)

## Secret-rotation policy

- Rotate `REVALIDATE_SECRET` and `FF_REVALIDATE_SECRET` together at the
  same time.
- Rotate provider API keys at least every 90 days.
- After rotation, redeploy the frontend and restart n8n workflows.

## Pre-commit checklist (NEW contributor)

1. Run `git diff -- .env.example` — placeholders only.
2. Run `grep -rE '(sk_live|FB[A-Z0-9]{20,}|AKIA[A-Z0-9]{16,})' .` — must
   return nothing.
3. Confirm `wp-config.php` constants in committed code are placeholders or
   comments only.
4. Confirm no `*.key`, `*.pem`, `*.p12` files in the working tree.
5. Run `grep -rE "FOOTBALL_DATA_API_KEY\\s*=\\s*['\"][A-Za-z0-9]{16,}" frontend/`
   — must return nothing.
6. Confirm no `NEXT_PUBLIC_*` variable name references a provider key,
   token, or secret.
