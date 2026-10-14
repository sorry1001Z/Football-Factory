# FF90 Production Readiness Audit

**Audit mode:** source and local-test inspection only
**Branch:** `codex/ff90-production-readiness`
**PR base:** `9b75fae5bb7fc44864ede5f890e07512d385fab0`
**Original audit worktree:** two local commits ahead of `origin/main` plus unrelated dirty files; these were excluded from this PR.
**Production changes:** none

## Executive result

**Status: BLOCKED for Production deployment.** This checkout is a Next.js application whose documented deployment root is `football-factory/frontend` on Vercel. It has no tracked Dockerfile, Compose file, Ubuntu systemd/nginx deployment config, or CI workflow. The requested Ubuntu 24.04 target therefore has no executable deployment contract yet. Production DB/VPS and browser-rendered Production behavior were not inspected.

One confirmed P0 source security defect was repaired: application and migration PostgreSQL connections now enable certificate verification and reject TLS disablement in `NODE_ENV=production`; database-driver messages and connection URL query values are no longer emitted by the migration runner. A webhook debug path was also changed to record only payload key names rather than full payload values. These changes are source-only; no connection or migration was run.

## Repository and engineering checks

| Area | Result | Evidence |
|---|---|---|
| Architecture | PARTIAL | Next.js App Router under `football-factory/frontend`; separate WordPress classic theme and `wordpress-plugins/football-factory-core`; workflows in `football-factory/automation/n8n/workflows`. Repository docs describe Vercel, not Ubuntu hosting. |
| Dependencies | PARTIAL | `frontend/package.json` uses Next 15, React 19, TypeScript, `pg`, `zod`; package-lock exists. Runtime Node version is not pinned in package `engines` or `.nvmrc`. |
| Unit/API tests | PASS | Clean PR worktree `npm test`: 1,169/1,169 passed. Tests use local stubs/fixtures; they do not establish Production behavior. |
| Typecheck | PASS | Final `npm run typecheck` passed after the build completed. |
| Build | PASS | Final `npm run build` completed. The invalid config warnings were fixed (`poweredByHeader`, top-level `typedRoutes`). No deployment artifact was installed. |
| Lint | BLOCKED | `npm run lint` invokes deprecated `next lint`, which opens an interactive ESLint setup prompt. No top-level ESLint dependency/config is present. |
| Docker/CI | MISSING | No tracked Dockerfile, Compose file, or CI workflow found. Docker executable exists on the workstation; no container command was run. |
| PHP compatibility | NOT TESTED | Plugin declares WordPress >=6.5 and PHP >=8.0; local PHP CLI/PHPCS is unavailable. Static source inspection only. |
| Environment checks | PARTIAL | `scripts/validate-prod.mjs` validates names/shapes without printing values; it has been tightened for PostgreSQL TLS. Its older FIRST SLICE classification is not a complete inventory of all currently used settings. |
| Production smoke | NOT TESTED | No deployment endpoints were called. A read-only health-check script passed mocked fetch tests only. |

## P0 findings and actions

1. **PostgreSQL TLS verification was disabled** in `lib/db/postgres.ts` and `scripts/migrate.mjs` with `rejectUnauthorized: false`. The application and migration runner now use verified TLS by default, sanitize driver SSL query parameters before handing the URL to `pg`, reject `sslmode=disable` in production, allow optional private trust roots through server-only `PGSSL_CA_CERT`, and emit generic DB error identifiers only. Unit tests cover the TLS policy. This does not verify a real database endpoint.
2. **Webhook payload values were logged** by the WordPress plugin when `WP_DEBUG` is enabled. `rest_n8n_event` now logs sanitized top-level key names only. PHP lint/runtime tests remain NOT TESTED because PHP tooling is absent.
3. **Ubuntu deployment path is missing.** No service unit, reverse-proxy configuration, Node runtime pin, build artifact contract, or CI release gate exists. Do not deploy to Ubuntu until these are deliberately specified and tested.
4. **Lint gate is not automated.** `npm run lint` is interactive and cannot be a CI/release check as currently configured.
5. **Unreleased local work is outside this PR.** The original workstation checkout was two local commits ahead of `origin/main` and contained unrelated image-automation/migration work, including a modified migration test that expected an untracked migration 007. Those files were not read, staged, or included. The clean branch migration suite passes. Any planned migration 006/007 rollout needs its own reviewed branch, isolated database acceptance and release gate.

## Final clean-branch test results

- `npm test`: PASS, 1,169/1,169.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; two existing Autoprefixer compatibility warnings remain.
- Targeted TLS, environment-validator, migration TLS-contract and mocked health-check tests: PASS, 26/26 total (5 TLS + 21 script tests).
- `npm run test:scripts`: PASS, 74/74.
- The original dirty workstation checkout had one migration-test failure because its modified test expected untracked migration 007; that local file was excluded, and the clean branch suite passes.
- `npm run lint`: BLOCKED by the interactive deprecated `next lint` setup prompt; no lint config/dependency is installed.
- PHP lint/PHPCS: NOT TESTED; PHP CLI is unavailable.
- `git diff --check`: PASS.

## Scope limits

No production credentials, database, VPS, Vercel, WordPress, or n8n were accessed. No workflow was executed. No migration was applied. Local working-tree changes unrelated to this readiness task were left unstaged and unmodified.
