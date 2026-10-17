# Hermes / plugin presentation contract

## Native news and media (available now)

Hermes continues using existing authorized WordPress REST / Core contracts.
It owns drafts, human approval, media rights and publishing. Theme activation
or layout switching performs none of these actions. No extra REST endpoints
or secrets are introduced by the theme.

- `post`: native published status, title, content, excerpt, permalink, author,
  date, category and Featured Image (`featured_media` / `_thumbnail_id`).
- Featured Image: WordPress attachment, alt text and optional caption; recommended
  1280×720 PNG/WebP, approved externally. Theme uses responsive native `srcset`
  when WordPress has generated sizes and `object-fit: contain`, never `cover`.
- Banner kind is read-only `_ff90_banner_kind` if available; otherwise a category
  slug; unknown values fall back to `general`. This theme does not register REST
  metadata; Hermes must use its existing plugin's permitted fields or category.
- Canonical classes: general, breaking, transfer, preview, result, standings,
  stats, tactics, team, competition, infographic, youth, feature.
- Aliases: transfers→transfer, match-preview→preview, statistics→stats,
  tactical→tactics, team-news→team, features→feature.

## Optional football renderer hooks (integration required)

These are new documented presentation extension points, not a claim that the
existing Core already implements them. An authorized football plugin may attach:

| Action | Arguments | Plugin responsibility |
| --- | --- | --- |
| `ff90_fixtures` | selected `Y-m-d` date in `wp_timezone()` | Render sourced fixtures for that date; read existing ISO-8601 `_ff90_kickoff_at` without rewriting it; escape output; show source / empty state. |
| `ff90_results` | none | Render verified results, with accessible markup. |
| `ff90_standings` | none | Render verified standings, with table caption and scoped header cells. |

The theme supplies date navigation (`?ff90_date=YYYY-MM-DD`), validates the date,
and provides containers. It neither calculates points nor assumes undocumented
score/team metadata. The inspected Core only registers content models / REST
surfaces, so enabling Core alone does not populate these panels. Widget areas
`ff90-sidebar`, `ff90-advertisement`, `ff90-footer` can also host plugin widgets.
Ad region is rendered only when a widget is assigned and is explicitly labeled.
The sidebar default is recent published stories, never a fabricated popularity
ranking. A real trending widget can be supplied by a plugin.

## SEO / analytics

`wp_head`, `wp_body_open`, `wp_footer`, `title-tag` and native WordPress article
canonical are retained. Theme emits no custom canonical, meta description,
Open Graph, JSON-LD or tracking scripts. SEO Growth V4 owns its own metadata and
must suppress core canonical if replacing it, as WordPress SEO plugins normally
do. Analytics owns its tracking hooks and consent handling. Neither plugin's
actual source is in this repository; real-version integration remains NOT_RUN.
Contract-test doubles must be clearly reported as doubles, not plugin QA.
