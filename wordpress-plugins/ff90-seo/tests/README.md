# Reproduce local checks

Use only a disposable real WordPress 6.5+ sandbox with
`define('FF90_QA_SANDBOX', true)` and native core/theme/media data.
Tests create and delete synthetic news and temporary terms, change SEO settings,
and restore values in finally blocks. Never run against staging with real news
or production. Do not run the WordPress/browser suites concurrently.

Verified local runtime: WordPress 6.9, PHP 8.4.24, SQLite integration, Chromium 154,
WP-CLI 2.12. Browser script uses the existing private sandbox admin file outside
the checkout; it never prints or packages the password. It creates a guarded
Classic Editor helper outside the checkout and removes it afterward.

```sh
python3 wordpress-plugins/ff90-seo/tests/build.py
# Install ZIP into the disposable sandbox via native plugin installer.
/workspace/ff90-tools/bin/wp eval-file /workspace/Football-Factory/wordpress-plugins/ff90-seo/tests/contracts.php
/workspace/ff90-tools/bin/wp eval-file /workspace/Football-Factory/wordpress-plugins/ff90-seo/tests/sitemap-scale.php
node wordpress-plugins/ff90-seo/tests/browser.cjs
node --check wordpress-plugins/ff90-seo/assets/editor.js
```

`contracts.php` covers canonical attacks, native permalink semantics, Thai warning
policy, H1 ownership, sitemap publication/privacy/noindex, taxonomy links, REST
permissions/types, unsaved analysis and opt-in gate final-state enforcement.
`sitemap-scale.php` creates 1001 posts and verifies every URL across bounded child
sitemaps, with no duplicates or truncation; its cleanup always removes fixtures.
`browser.cjs` exercises real Gutenberg unsaved analysis and metadata save, native
Classic Editor form, native Settings API save, Core schema coordination and HTTP
sitemap/robots routes. It saves screenshots and JSON evidence under docs/qa.

Build is deterministic and allowlists runtime PHP/JS, license and readme only.
No tests, screenshots, generated QA news, secrets, docs or other plugins in ZIP.
Compare every source/install/package byte before claiming install validation.

No actual GSC, original external SEO V4, football data provider, Hermes/n8n,
MySQL/MariaDB, Firefox/Safari, production/CDN or external staging has been tested.

## 0.2.0 modular tests

The compatibility build entry point now calls `modules/ff90/build.py`, which
packages base SEO, optional Football and optional GSC separately. Install those
ZIPs in a disposable sandbox; activate base first, then the optional plugins.

Additional checks, sequential (WordPress/browser scripts mutate sandbox state):

```sh
# Export references from frontend cwd with its existing tsx dependency:
node --import tsx ../../wordpress-plugins/ff90-seo/tests/export-v3.cjs
# Remaining commands from repository root:
/workspace/ff90-tools/bin/php wordpress-plugins/ff90-seo/tests/parity.php
/workspace/ff90-tools/bin/wp eval-file /workspace/Football-Factory/wordpress-plugins/ff90-seo/tests/advanced-contracts.php
/workspace/ff90-tools/bin/wp eval-file /workspace/Football-Factory/wordpress-plugins/ff90-seo-gsc/tests/contracts.php
python3 wordpress-plugins/ff90-seo/tests/portability.py
node wordpress-plugins/ff90-seo/tests/browser.cjs
```

Parity: 47 original-TS reference cases under PHP Intl (including fullwidth NFKC).
Advanced: 28 module/link/quality/graph contracts with disposable term mappings.
GSC: 29 explicitly HTTP-doubled OAuth/PKCE/encryption/refresh/property/query/revoke
checks; refuses to overwrite any existing real client config or token connection.
No actual client IDs, client secrets, grants, properties or metric rows are saved
by those tests. Pure/WordPress checks never substitute for Google live verification.
Browser adds real target-keyword intent and schema results, disconnected GSC UI,
POST-only OAuth action, nonce rejection and explicit missing-config response.
PHP local toolchain added Intl from signature/checksum-verified Debian APT sources;
no TLS/checksum verification was bypassed. It remains outside the checkout.
