# FF90 SEO Intelligence — End-to-end integration & blockers (2026-10-19)

## What exists in PR #5
- `seo-intelligence/engine.py`: GSC Search Analytics, Ahrefs v3 keyword overview (explicit opt-in), manual official Trends exports; ranks topics without inventing missing inputs.
- `seo-intelligence/dispatch.py`: HTTPS-only, application-password-authenticated report submission, **dry-run by default**.
- `wordpress-plugins/ff90-seo-inbox/ff90-seo-inbox.php`: private `ff_seo_proposal` CPT and permission-protected REST inbox; idempotent upsert by keyword; **never publishes WordPress news posts**.
- Tests: seed/fixture evaluation and dispatch safety checks. The connector host cannot clone GitHub into the code runner; **tests have not yet been executed in a repository checkout**.

## Install in STAGING, not production

1. Checkout branch `feat/ff90-seo-intelligence-v1` and run:
   `python -m unittest discover -s seo-intelligence/tests -v`
2. Generate a fixture report:
   `python seo-intelligence/engine.py --gsc-json seo-intelligence/tests/gsc.json --ahrefs-json seo-intelligence/tests/ahrefs.json --trends-csv seo-intelligence/tests/trends.csv --output /tmp/seo-report.json`
3. Confirm that it reports no production writes:
   `python seo-intelligence/dispatch.py --report /tmp/seo-report.json`
4. Install **ff90-seo-inbox** into the staging WordPress plugins folder. Configure in `wp-config.php`: `define('FF90_SEO_INBOX_ENABLED', true);`. Do not enable on production before review.
5. Create a dedicated staging WordPress user with appropriate `edit_others_posts` capability, and a WordPress Application Password.
6. Set `FF90_SEO_WP_ENDPOINT=https://YOUR-STAGING-HOST/wp-json/ff90-seo/v1/proposals`, `FF90_WP_USER`, `FF90_WP_APP_PASSWORD`, and `FF90_SEO_WRITE_ENABLED=true` as secrets (never commit).
7. Submit privately: `python seo-intelligence/dispatch.py --report /tmp/seo-report.json --send`. Check private SEO Proposals screen; re-run to confirm idempotency.
8. For real data, authorize GSC with read-only Search Console OAuth scope; select the correct property. Export Google Trends in a comparable time/geography context. Check Ahrefs API entitlement and unit consumption **before** enabling `--fetch-ahrefs`.
9. Operationalize later via a **separate disabled-by-default n8n workflow** after staging smoke and evidence review; do not route into the existing 30–40 news publish chain without duplicate controls, source rights verification and manual approval.

## Known blockers / required human access
- **GSC OAuth**: no authorized Search Console access token/property access was provided; not connected live.
- **Ahrefs**: no authenticated API key or verified eligible API plan; paid requests disabled.
- **Google Trends**: official API is an access-restricted alpha; CSV import is available, but fully automatic harvesting is not configured.
- **Site environment**: no staging WordPress installation / user application password / n8n instance credentials have been provided or accessible here.
- **Testing**: external GitHub DNS resolution failed in the code-runner. Do not claim CI PASS or E2E PASS until actual outputs exist.
- **Content checks**: do not equate multiple GSC URLs with confirmed cannibalization; requires editorial review and topic-level clustering. No actual news generation or production publishing is implemented.

## Go-live gates
- Unit tests green (plus PHP syntax check)
- Staging plugin installed; authenticated REST rejects anonymous requests
- Same report sent twice causes no duplicate proposals
- Broken or wrong-site payload rejected
- No public article created by report
- GSC pagination and Ahrefs response validated against their APIs
- News approval pipeline integration scoped separately; kill switch remains OFF

## Rollback
Disable `FF90_SEO_INBOX_ENABLED`; disable plugin. Nothing is published or migrated. Existing private proposals can remain for audit.
