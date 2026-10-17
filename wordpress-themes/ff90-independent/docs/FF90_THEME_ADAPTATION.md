# FF90 theme adaptation and license audit

## Authority and file plan

Read GitHub Issue #2 (public HTML; GitHub API is forbidden in this environment), AGENTS.md, FF90_DUAL_LAYOUT_BLUEPRINT.md and FF90_CODEX_TASK.md at docs/ff90-dual-layout-e2e-v03 commit 9e2775bdc35743f9238086f6f87cc21566dcf7e1. The more recent blueprint explicitly permits an original theme. All changes are isolated under wordpress-themes/ff90-independent on codex/ff90-independent-theme from main.

Original implementation, not a child theme and no parent dependency. ColorMag free reference style.css at dd2f4ce50bd0b212bf3d3da7a084b605f35beb91 was fetched and verified to declare version 4.2.5 and GPLv3. No ColorMag source, assets, fonts, trademarks, photographs or paid Pro/Plus code copied. Category-first modules and a large-plus-four story mosaic are implemented with original PHP/CSS. GPL-3.0-or-later applies to this theme. Native system fonts; no third-party CDN requests.

- functions.php / inc/presentation.php: theme supports, sanitized native Customizer setting, read-only queries, banner classes and display date.
- header.php / footer.php / sidebar.php / searchform.php: shared chrome and widget regions.
- front-page.php / template-parts/layout-*: two homepages, fixtures slot, news mosaic.
- index.php: native category/tag/author/date/archive/search/blog fallback.
- single.php / page.php / 404.php / comments.php: native WordPress template hierarchy.
- style.css / assets/js/theme.js: responsive presentation, accessible mobile menu, optional local dark mode.

## Plugin ownership

FF90 Core at wordpress-plugins/football-factory-core registers ff_match, ff_team, ff_player, ff_league, ff_transfer, ff_season and ff_competition. It does not provide a published fixtures-rendering API or register _ff90_kickoff_at in the inspected file. The theme therefore does not infer score/meta contracts. It offers hooks for plugins to render verified data; Core custom post archives and singles work through the native template hierarchy. Theme never modifies plugin files.

SEO Growth V4 and Analytics source are absent from this checkout. Native wp_head, wp_body_open, wp_footer, title-tag and core canonical behavior are preserved; the theme outputs no description, canonical, Open Graph, JSON-LD or analytics script itself. Actual plugin versions must be tested when supplied; test doubles demonstrate hook compatibility only.

Theme does not create post types, migrate records, save news or media, calculate standings, call football providers, activate n8n or publish. Automation and image rights remain Hermes/plugin responsibilities. Switching ff90_home_layout changes only a theme_mod through the capability/nonce protected native Customizer.
