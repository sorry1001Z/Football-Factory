# Modular foundation QA

Only run in a **disposable local WordPress** sandbox explicitly defining
`FF90_QA_SANDBOX=true`. Tests create/delete synthetic users, news, images,
job rows and private content exports, change settings/theme temporarily and
restore them. Never run against production or a site containing real data.
Run WP/browser suites sequentially; their finally cleanup must complete first.

## Environment

Verified: WordPress 6.9, PHP 8.4.24 (GD/DOM/Intl/sodium), SQLite DB integration,
WP-CLI 2.12, Chromium 154, Playwright/axe. Existing private local admin password
is read outside the checkout and never printed or packaged. No package/library
installation disables signature, checksum or TLS checks.

```sh
# Repository root. Build each ZIP, then install/activate dependencies in sandbox:
python3 modules/ff90/build.py
/workspace/ff90-tools/bin/wp plugin activate ff90-security ff90-content-qa ff90-editorial-approval ff90-football-data ff90-football-widgets ff90-image-registry ff90-banner-renderer ff90-automation-bridge ff90-operations
/workspace/ff90-tools/bin/wp eval-file /workspace/Football-Factory/modules/ff90/tests/contracts.php
node modules/ff90/tests/browser.cjs
```

PHP runner refuses real football credentials/backup configuration and uses only
an in-process synthetic token, HTTP test doubles and a temporary private backup
directory. Entire runner output is buffered so native `export_wp` executes before
headers are sent, matching its real admin-post use. This does not suppress errors.
Every produced WXR/checksum/temp image/test user/job is cleaned in finally.

Browser runner requires loopback URL and uses actual native Settings API,
Gutenberg source meta, human QA form, independent editorial approval and ordinary
REST publish/deny. It then temporarily installs a sandbox-guarded MU HTTP double
for football. Fixture page/title/body visibly say SYNTHETIC, not live results.
The helper is removed and options/cache/quota/theme restored in finally.
No test creates real audience numbers or sends messages/publishes to production.

## Expected checks

- 84 PHP contracts: human/self/stale review, pause, native REST/Classic final
  source preflight, scheduling before publication hooks, private source visibility,
  rights, byte duplicates, resized visual similarity, leases, 13 uncropped kinds,
  existing theme category fallback, provider normalization/cache/null scores/
  stale/error/quota/backoff/validation, queue idempotency/retry/recovery/lost-lease,
  denied anonymous endpoints, private WXR/permissions/checksum and login throttle.
- 13 browser cases including 5 widths (360,390,768,1024,1440), zero axe WCAG2A/AA
  and 2.1AA violations in fixture frontend, a different native theme, and zero
  browser exceptions. Checks visible image **content box**, accounting for theme
  borders and responsive image rounding, within 1 pixel, and object-fit contain.
- Build: independent allowlisted ZIPs, runtime/source/install byte equality,
  native activation and no accidental dependency on FF90 theme functions.

HTTP DOUBLES are not real provider integration. MySQL/MariaDB, external staging,
real n8n/cron/Hermes, Google, provider entitlement/data quality, offsite monitoring,
full backup/restore and cache-aware analytics are **NOT_RUN**. PHP direct
wp_publish_post/SQL bypass is a documented trust boundary, not tested/claimed as
blocked by WordPress filter-based gates. Read STATUS_TH.md and QA_REPORT.md.
