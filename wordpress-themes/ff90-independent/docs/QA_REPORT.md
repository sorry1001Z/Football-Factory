# FF90 Independent — QA report

Date: 2026-10-17 (Asia/Bangkok). Branch: `codex/ff90-independent-theme`.
Scope: original standalone theme under `wordpress-themes/ff90-independent/`.
Existing theme, plugins, Hermes automation and production are unchanged.

## Readiness

**Local WordPress theme acceptance: PASS.** An actual self-contained ZIP was
installed and activated on a real disposable WordPress 6.9/PHP 8.4.24/SQLite
instance. Chromium testing ran against the unpacked ZIP, not static mock HTML.
This does **not** certify external staging, production, MySQL/MariaDB, or plugin
versions that were not supplied. No deployment or automation activation occurred.

## Executed checks

| Check | Result | Evidence / limits |
| --- | --- | --- |
| PHP syntax | PASS | `qa/php-lint.txt`; runtime and test PHP files parsed with PHP 8.4.24. PHP 7.4 runtime NOT_RUN. |
| Theme JavaScript parse | PASS | `node --check assets/js/theme.js`; actual navigation/dark-mode behavior also exercised in Chromium. |
| WordPress Theme Check on installed ZIP | PASS, exit 0 | `qa/theme-check.json`; no REQUIRED failures or WARNING entries. Four optional recommendations: block patterns, block styles, custom header, custom background. |
| WP data/setting contracts | PASS, 217 checks | `qa/wp-contracts.txt`; allowlist, Customizer capability, published-only queries, 13 kinds, date input, content/permalink/media/meta invariance, ISO-8601 `_ff90_kickoff_at` preservation. |
| Browser scenarios on installed ZIP | PASS, 32/32 | `qa/browser-results.json`; no browser runtime exceptions. |
| Both homepages × 360/390/768/1024/1440 | PASS, 10/10 | Real full-page screenshots; DOM horizontal overflow and image loading/contain checks; long Thai titles. |
| Automated accessibility | PASS in tested scope | Axe WCAG 2 A / AA and WCAG 2.1 AA tags: zero violations in 10 home layouts, two dark-mode views and 12 inner-page views. This is not a full manual WCAG certification. |
| Mobile navigation | PASS | Open/close, Escape, focus restoration; no-JavaScript mobile navigation remains available. |
| Light/dark preference | PASS | 390/1440, local persistence after reload; no external storage. |
| Article/category/search/empty search/404/author | PASS | Each at 390/1440; expected statuses including real 404; one main h1. |
| All 13 banner classes | PASS | Each native article had its expected class and 1280×720 Featured Image displayed without distortion. Card images use `contain`; no text line clamps. |
| Native Customizer layout switch | PASS | Browser login, select A → Publish, select B → Publish, persistence verified; `customizer-layout-switcher.png`. |
| Missing Customizer nonce | PASS: rejected | Authenticated request without nonce did not save a setting. |
| FF90 Core plugin off/on | PASS | Both layouts work without Core; no fake fixtures or fatal errors after deactivation; reactivation works. |
| Optional football/SEO/analytics hooks | PASS as TEST DOUBLE only | Local probe verified date arguments, results/standings slots, wp_head/wp_footer, one replacement canonical. Probe removed after test. Not real SEO Growth V4/Analytics validation. |
| Homepage with no published news | PASS, both layouts | `qa/edge-results.json`; drafts invisible, no fake breaking strip, honest empty state; axe clean. |
| Article without Featured Image | PASS | Native post renders without fabricated media; homepage has branded placeholder. |
| Search/date injection input | PASS | Script input did not execute; invalid dates fall back to WP timezone today. |
| Native SEO collision checks | PASS | `qa/seo-results.json`; both layouts × home/article/category/search; one title, no duplicate canonical/description/JSON-LD entity. Scope is WordPress + existing Core. |
| ZIP structure / reproducibility | PASS | One `ff90-independent/` root; only allowlisted runtime/theme metadata files; no tests, credentials, screenshots gallery, reports or nested ZIPs. Two builds had matching SHA-256. |

## Screenshots

All content and artwork in these screenshots is explicitly **synthetic QA**,
not real football news, scores, photography or verified player information.
No licensed production media is copied. Banner corner frames are visible to
help inspect full-frame rendering.

- Layout A: [desktop](qa/screenshots/main-v2-1440.png), [mobile](qa/screenshots/main-v2-390.png).
- Layout B: [desktop](qa/screenshots/colormag-01-1440.png), [mobile](qa/screenshots/colormag-01-390.png).
- [Customizer](qa/screenshots/customizer-layout-switcher.png).
- [Article](qa/screenshots/article-390.png), [category](qa/screenshots/category-390.png).
- [Dark desktop](qa/screenshots/dark-1440.png), [dark mobile](qa/screenshots/dark-390.png).
- The gallery also includes the full 10 viewport/layout combinations, search,
  empty search, 404, author, empty homepages and missing-image article.

## Diagnosis and remaining gates

- **NOT_RUN — actual SEO Growth V4 and Analytics:** their source/version is not
  in this checkout. A test double is not a substitute. Existing FF90 Core itself
  emits schema; final SEO plugin integration must coordinate that ownership.
- **NOT_RUN — live fixtures/results/standings:** no sourced football data/renderer
  plugin is configured. Core 0.1.0 provides model/REST scaffolding and an empty
  view model, not these renderer hooks. The theme provides documented optional
  hooks and honest fallback. Hermes/football plugin implementers must connect
  verified data using `docs/PLUGIN_CONTRACT.md`; no scores were invented.
- **NOT_RUN — Hermes live ingestion and approved Image Factory assets:** native
  post/media compatibility was exercised locally, but no live workflow was
  executed or modified. Keep human review, image rights and kill switch intact.
- **NOT_RUN — external staging/production, MySQL/MariaDB, Safari/Firefox,
  assistive-technology/manual screen-reader audit.** Local Chromium/SQLite is
  the verified environment. Requires a separate operator-controlled staging
  acceptance before any production activation.
- WordPress background update checks warned because sandbox outbound HTTP
  updates are intentionally disabled. ZIP install, frontend and Theme Check
  succeeded; this is not a production connectivity claim.
- Initial QA found footer accent contrast below the large-text threshold;
  corrected to a lighter accent and reran the matrix with zero axe violations.
  Initial browser lazy-image waiting and Customizer asynchronous save checks
  were corrected in the harness; final tests wait for actual loads/save response.

## Delivery / handoff

Use `python3 tests/build.py` to reproduce `dist/ff90-independent-1.1.0.zip` and
its `.sha256` file. Repository-wide `dist/` is ignored, so ZIP is a generated
local deliverable, not silently force-added to Git. Source-controlled reports,
screenshots, tests, GPL text, notices and plugin contracts remain in this theme
folder. Follow `tests/README.md` to reproduce the runtime QA. No production
approval is implied by these local results.

## Football navigation update

The current menu has two distinct roots: **ข่าวฟุตบอลลีก** (the existing menu
label renamed, five league links retained) and **บอลถ้วย** (13 cup links).
See LEAGUE_MENU.md for the full names and native admin configuration. Existing
news/category URLs, published posts and media are unchanged. Only the
disposable sandbox menu/category records were configured; production is untouched.

`qa/submenu-results.json` records both layouts at all five widths, two separate
submenus, 18 HTTP 200 child-category destinations, hover/keyboard access, axe
at 390/1440, and last-item keyboard access at 1440×600. Long desktop dropdowns
scroll; mobile uses normal page scrolling. Updated images:
`qa/screenshots/league-menu-desktop.png`, `cup-menu-desktop.png`, and
`league-menu-mobile.png`. Earlier gallery images document the prior baseline.
The current generated ZIP checksum is in `qa/package-results.json`.

## Smart Variety visual adaptation — 1.1.0

Selected GPL-v2-or-later decoration from the user-supplied Smart Variety 1.0.7
was adapted as a separate FF90 CSS skin, with attribution and original license
in the distributable. Native header markup adds a desktop search alongside the
centered logo; only one search form is visible at each breakpoint. No vendor
PHP/JavaScript, manager, fonts, demo photographs or branded assets were imported.
See SMARTVARIETY_ADAPTATION.md for source files, hashes and license review.

Revalidation against the installed 1.1.0 ZIP: 217 WP data contracts, all 32
browser scenarios (including the 10 homepage viewport/layout combinations,
dark mode, inner pages, Customizer and zero tested axe violations), native
league/cup regression, SEO and empty/media/security checks. Fresh evidence is
in `qa/`; gallery screenshots now show the adapted decoration. Theme Check
remains exit 0. The live indytheme.com reference page could not be fetched
(proxy CONNECT 403), so no claim of visual inspection or pixel parity is made.
