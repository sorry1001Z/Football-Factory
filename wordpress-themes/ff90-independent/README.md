# FF90 Independent 1.1.0

Original, standalone WordPress theme. PHP 7.4+ / WordPress 6.5+. No parent,
builder, paid theme, external font or API key required. Source and deliverables
are isolated here; existing themes, plugins and Hermes workflows are unchanged.

## Install

1. Use `dist/ff90-independent-1.1.0.zip` or run `python3 tests/build.py`.
2. On a staging WordPress site: Appearance → Themes → Add New → Upload Theme.
3. Activate FF90 Independent. Assign Primary / Footer menus and sidebar widgets.
4. Publish native posts with licensed Featured Images (1280×720 recommended).
5. Appearance → Customize → FF90 Homepage Layout → choose Layout A — Main V2
   or Layout B — ColorMag 01 → Publish. B is the default.

`front-page.php` displays the editorial homepage for both Reading settings;
a separate Posts page uses the standard native blog loop. Selecting a static
page as the front page will not display that page's body: use a normal inner
page for page content. Native categories, tags, author archives, search,
permalinks, post content and media do not change when switching layouts.

No content is imported during theme activation. An empty site shows an honest
empty state, and a site without football plugins shows an unavailable-data
message. No fake scores, fixtures, traffic rankings or live-feed labels.

## Layouts

- **A — Main V2:** large-plus-four mosaic, priority headlines, latest thumbnail
  feed and sidebar. Latest feed supports native pagination.
- **B — ColorMag 01:** shared mosaic, up to six populated categories, each with
  a lead story plus two smaller stories, shared sidebar.

All banner kinds use the same uncropped 16:9 media container; article images
retain their original ratio. Image text is not repeated as a CSS overlay.
Categories alone do not grant image rights: Hermes/plugin approval remains
required before publishing media. Navigation works without JS; JS adds a
collapsible mobile menu, Escape focus restoration, and optional local dark mode.

## Integrations and handoff

See [plugin contract](docs/PLUGIN_CONTRACT.md),
[adaptation/license audit](docs/FF90_THEME_ADAPTATION.md) and
[QA report](docs/QA_REPORT.md). The theme never publishes news, writes SEO or
analytics, registers football models or edits Image Factory / n8n workflows.
Activate actual plugin versions in staging for final integration acceptance.

## QA and build

See [reproduction](tests/README.md). Run PHP lint, JS parse, WordPress Theme Check,
local WP contracts and Chromium/axe matrix before release. The ZIP excludes
QA seeds, test scripts, reports and screenshots. Theme activation itself never
runs any of the tests. `docs/qa/screenshots` contains actual local WP screenshots
with visibly synthetic content, not a screenshot of production news.

## Rollback

Customizer → select the previous layout → Publish. Switching changes only
`theme_mods_ff90-independent.ff90_home_layout`; no news/media migration occurs.
For theme rollback, reactivate the previous theme; native posts and media are
retained. Back up the staging database before installation. Production changes
require a separate operator approval.

GPL-3.0-or-later. See LICENSE and NOTICE.

## Smart Variety visual adaptation (1.1.0)

Selected decoration from the user-supplied Smart Variety 1.0.7 is adapted in a
separate CSS skin: centered desktop masthead, rounded search, category pills,
menu underline/dropdown surfaces and section title borders. Both homepage
layouts and native league/cup menus remain supported. Original FF90 business
logic boundaries are unchanged. See docs/SMARTVARIETY_ADAPTATION.md, NOTICE and
licenses/SmartVariety-GPL-2.0.txt for provenance and licensing.
