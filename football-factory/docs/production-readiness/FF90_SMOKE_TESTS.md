# FF90 Smoke Tests

## Local release gates

Run from `football-factory/frontend`:

```powershell
npm test
npm run typecheck
npm run build
npm run test:scripts
node --test scripts/__tests__/validate-prod.test.mjs scripts/__tests__/postgres-tls-contract.test.mjs scripts/__tests__/production-healthcheck.test.mjs
```

`npm run test:scripts` passes 74/74 on the clean PR worktree. The original dirty workstation checkout had one additional modified migration test that expected an untracked migration 007; that test was excluded from this PR. `npm run lint` is blocked because `next lint` starts an interactive setup prompt. PHP lint/PHPCS is not available in this workstation environment.

## Read-only HTTP health check

The new `scripts/production-healthcheck.mjs` makes only GET requests and refuses to choose a target implicitly. It checks:

- `/api/health` body contract
- homepage returns HTTP 200 HTML
- `/api/health/wordpress?probe=1` reports configured and reachable
- `/robots.txt` and `/sitemap.xml` return 200
- a known published `/news/<slug>` path returns 200

Example after a human has selected and authorized the target:

```powershell
$env:BASE_URL = 'https://<approved-host>'
$env:ARTICLE_PATH = '/news/<known-published-slug>'
node scripts/production-healthcheck.mjs
```

Do not set credentials in URL, query, or command history. This audit did not invoke this script against any deployed environment. Unit tests stub `fetch` and do not create posts or mutate state.

## Security probes

Use `npm run smoke:security` only against an explicitly approved target: it sends unauthenticated GET/POST probes, including an empty registration POST. It does not create a user when validation behaves as expected, but it is an external request and was not run here. Do not send valid credentials or invoke write workflows as part of smoke testing.

## SEO/readback

`npm run smoke:seo` requires a real public article path for meaningful validation. Confirm the emitted `<title>`, description, canonical, Open Graph and NewsArticle structured data against the rendered HTML. Database/payload fields alone are insufficient. No live HTML was fetched in this audit.
