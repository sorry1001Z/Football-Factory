# FF90 WordPress — Dual Homepage Blueprint (approved 2026-10-17)
**One standalone theme, two homepage layouts.**
Admin selector: `Appearance → Customize → FF90 Homepage Layout`; `theme_mod=ff90_home_layout`, allowlisted `main-v2` or `colormag-01`, default `colormag-01`.
## Shared modules
1. Utility topbar, site identity/custom logo, keyboard accessible main navigation, search.
2. Dynamic published-news strip; never imply live feed when no live source.
3. Fixture strip with Prev/Today/Next, WP timezone, existing ISO-8601 `_ff90_kickoff_at`; no invented fixtures.
4. Featured mosaic: one large and four small articles, native WP posts and media.
5. Sidebar (ad region, trending news, categories), footer, article, archive, category, search, 404.
6. Inherit SEO / analytics / football models / rights / automation only from plugins; theme does not write SEO meta or publish.
## Layout A: Main V2 (inspired by ColorMag Pro visual demo, not paid source)
Hero 1+4 → a compact priority headline strip → news-dense latest feed with thumbnail + title/excerpt → sidebar and ad slots. Optional standings/analysis widgets via plugin hooks. 
## Layout B: ColorMag 01
Hero 1+4 → category-first three-story modules (large lead plus two smaller), up to six populated categories → sidebar/trending/ad. Layout still includes shared fixtures.
## Images
13 visual kinds: general, breaking, transfer, preview, result, standings, stats, tactics, team, competition, infographic, youth, feature. All banner files rendered externally by Hermes, attached as WP Featured Images, 1280×720 WebP/PNG. Theme never scrapes images and must not crop essential content.
## QA gate
2 layouts x widths 360/390/768/1024/1440, mobile nav, contrast/a11y, long Thai headlines, hero/13 image classes, real WP plugin-on/plugin-off, SEO duplicate canonical/schema, preserve permalinks and featured media when switching, rollback. No production deploy before explicit approval. No paid ColorMag Pro/Plus assets/code. Free ColorMag is GPL but retain notices if copying GPL code.
## Local preparation
A separate **original** FF90 theme starter v0.3.0 exists as ChatGPT-generated ZIP (not checked into this repository); GitHub Issue #2 remains implementation owner. Do not assume Codex can reach ChatGPT sandbox artifacts.