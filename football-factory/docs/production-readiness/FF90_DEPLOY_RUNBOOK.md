# FF90 Deployment Runbook and Go/No-Go

**Current release decision: NO-GO.** No deployment was performed.

## Release prerequisites

1. Decide whether the frontend remains on Vercel (documented current target) or moves to Ubuntu 24.04. Do not treat the source as Ubuntu-ready until Node version, process manager, reverse proxy, TLS, logs, health probes, static assets and rollback are tested together.
2. This PR base tracks migrations 001–005. Before a future release, identify every schema migration required by the selected source commit. Any planned image/draft-operation migrations beyond 005 must be reviewed and tested on an isolated restored PostgreSQL database with the actual runner; do not apply them to Production as part of this runbook.
3. Install a non-interactive lint tool/config and make CI gates reproducible. No CI workflow is tracked now.
4. Run PHP lint/PHPCS on the theme and plugin in a PHP 8+ environment; run WordPress compatibility checks against the declared minimum version.
5. Run all tests, typecheck, build, static workflow validation and the new mocked health-check tests on a clean release candidate.
6. Verify effective Production env state and endpoint availability through authorized read-only checks. Keep `AUTOMATION_ENABLED=false` unless a separate controlled window is explicitly approved.
7. Take and verify a restorable database and WordPress backup before any future production mutation.

## Environment checklist

Use the actual deployment secret manager. Never commit `.env.local`, `DATABASE_URL`, auth secrets, provider keys, WordPress application passwords, or automation secrets.

**Frontend/public:** `NEXT_PUBLIC_SITE_URL` (canonical public origin).
**WordPress read/write:** `WORDPRESS_GRAPHQL_URL`, `WORDPRESS_REST_URL`, `WORDPRESS_APP_USER`, `WORDPRESS_APP_PASSWORD`.
**Next server security:** `AUTH_SECRET` (>=32 chars, random), `REVALIDATE_SECRET`, `AUTOMATION_SECRET`, `AUTOMATION_ENABLED` (default/initial `false`).
**Database:** `DATABASE_URL` (TLS with certificate verification), optional `PGSSLMODE` (`require`, `verify-ca`, `verify-full`; default `verify-full`), optional `PGSSL_CA_CERT` PEM.
**Providers/optional integrations:** `FOOTBALL_DATA_API_KEY`, `API_FOOTBALL_KEY`, provider limits/base/timeouts, email/analytics/n8n variables only where the corresponding feature is approved and configured.

`npm run validate:prod` reports environment names and status only; it does not prove reachability or correct Production scope. It must be run in the target environment after env provisioning, without copying its output values from secret stores.

## Ubuntu 24.04 deployment outline (NOT EXECUTABLE YET)

This repository currently documents Vercel. The following is a future checklist, not an approved or tested install procedure:

1. Build a clean release from a pinned commit using the documented frontend root and `npm ci`.
2. Pin a supported Node LTS version and verify it against Next 15 before installing on the host.
3. Run the service as an unprivileged account bound to loopback only. Put secrets in a root-readable environment file or systemd credential facility, not the repository.
4. Put a reviewed TLS reverse proxy in front; set explicit request/time limits and preserve forwarded host/proto safely.
5. Configure persistent logs, restart limits, disk monitoring, health probes and backup retention.
6. Validate the exact service unit/proxy config on a disposable Ubuntu 24.04 VM before any production action.

## Rollback plan

No rollback action has been run. Before deployment, preserve the prior release artifact and database snapshot. On a future Vercel release, use the provider-supported promotion/rollback to the recorded prior Ready deployment; verify public routes afterward. On a future Ubuntu deployment, deploy versioned release directories and atomically switch a `current` symlink, then restart the service; retain the previous directory and config for immediate revert. Database schema changes require a separate migration-specific rollback/restore plan and must not be rolled back blindly if writes have occurred.

## Go / No-Go checklist

- [ ] Target architecture and domain routing approved; Ubuntu-vs-Vercel mismatch resolved.
- [ ] Clean branch commit and artifact hashes recorded; unrelated local changes excluded.
- [ ] `npm test`, `npm run typecheck`, `npm run build`, lint, PHP checks and workflow validation PASS.
- [ ] Migration suite passes on isolated restore; migration 007 source and rollback reviewed.
- [ ] WordPress and PostgreSQL read paths verified on the target, with no mock fallback mistaken for live data.
- [ ] Secret variables validated by name/status only; TLS verifies DB certificate.
- [ ] Kill switch remains closed unless a separate authorized automation window exists.
- [ ] Admin unauthenticated and automation unauthorized smoke checks reject correctly.
- [ ] Backup restore procedure and rollback target verified.
- [ ] Production smoke test passes with a known published article path.

Any unchecked P0 item means NO-GO.
