# SEO WordPress port — accepted scope and implementation map

User authorization: migrate reusable modules A–L; SEO additions supplied in chat
2026-10-17. Package version **0.1.0**, deliberately **not a completed SEO V4**.
Pure PHP policy with WordPress adapters and native Gutenberg React packages.
No Node service, external content analysis, theme requirement or FF90 domain URL.

## Current implementation

| Requirement | Implemented behavior |
|---|---|
| Gutenberg | Native document sidebar, debounced analysis of unsaved title/body/meta, ignores stale responses; native meta save |
| Classic editor | Nonce/capability-protected meta box, saved-content report |
| Metadata | Private `_ff90_seo` post meta exposed to authorized native editing; global `ff90_seo_settings` via Settings API |
| Canonical | Native permalink default; same-origin HTTP(S) overrides; no credentials, control characters, backslashes or dot segments; strips tracking, preserves native identity query keys and trailing slash |
| Content quality | Title/meta length, approximate Thai term count, thin-content and image-alt review warnings; body H1 plus configurable theme-title H1 |
| Gate | OFF by default; optional structural title/canonical/H1 veto; warning scores never independently veto Thai content |
| Internal linking | Suggestions to assigned public category/tag/taxonomy archives when labels appear in plain body text; excludes anchors/headings/scripts/styles/comments/attributes; ambiguous assigned labels withheld; no content mutation |
| Schema | Optional standalone NewsArticle/WebPage with actual post dates, author, publisher and attachment URL; JSON safely encoded |
| Indexing | Optional noindex through `wp_robots`; respects native site privacy, excludes noindex/password content from native sitemap |
| Sitemap | Uses native WordPress sitemap, not a second ordinary sitemap generator |
| News sitemap | `/ff90-news-sitemap.xml`, last 48 hours of public nonpassword post content; 1000 URLs per child file, paginated sitemap index if necessary; robots discovery; no HTTP output in advisory/private mode |
| Domain extension | Framework-independent `FF90\SEO\DomainAdapter` interface and `ff90_seo_domain_adapter` filter; entity/schema suggestions exposed to analysis only |
| Ownership | Advisory default; explicit standalone; known Yoast/RankMath/AIOSEO/SEOPress constants or `ff90_seo_external_owner` suppress standalone; exact known Core schema callback coordinated on singular pages |

## V3 parity limits and remaining work

This release is an initial port, not byte-for-byte V3 output parity. V3 original
sources remain unchanged. In particular:

- Canonical overrides are stricter than V3 (same origin including scheme/port,
  no external allowlist, root-relative paths only). Native `?p=ID` identity must
  not be stripped like arbitrary tracking parameters. WordPress trailing slashes
  must be retained. These are intentional WordPress compatibility changes.
- Quality scoring is a subset of V3. Sentence/paragraph/repetition/stuffing,
  provenance and schema completeness scoring, refresh/duplicate signals and
  threshold customization have not been ported. Score is not a ranking promise.
- Thai counting is an explicitly approximate length-based signal, not a real
  segmenter or the exact V3 orthographic-cluster algorithm. Never a hard veto.
- Full V3 intent classification, entity relations, link offsets/confidence and
  registered football identity datasets are not ported. Assigned-taxonomy
  suggestions alone are not a complete football knowledge graph.
- Football SportsEvent/SportsOrganization/Person auto-generation awaits the
  verified entity/match data adapter. Schema is not invented from article text.
- GSC OAuth, Google PHP client, encrypted token storage/refresh/revoke,
  property ownership selection and Search Analytics fetching are **NOT IMPLEMENTED**.
  UI reports disconnected; no mock clicks, impressions or positions are shown.
- News sitemap inclusion is not a Google News eligibility/acceptance guarantee.
  Google Indexing API is **not appropriate for ordinary news/live scores**:
  only eligible JobPosting or BroadcastEvent embedded in VideoObject content.
  No indexing API request, retired sitemap ping or automatic URL Inspection
  indexing request is implemented.

## Integration / security boundaries

WordPress REST analysis is authenticated and requires `edit_post` per post.
Cookie requests use WordPress REST nonce; Application Passwords use native HTTPS
WordPress authentication. This module adds no token or public write endpoint.
REST accepts bounded string inputs; it neither fetches source URLs nor sends
article content externally. Third-party domain adapters are trusted server code.

The SEO gate is an editorial structural check, not an authorization perimeter.
Final-state rechecks catch canonical metadata changes and direct `wp_publish_post`,
but direct trusted plugin calls/SQL and other hooks can observe intermediate
transitions. Do not use it as a substitute for transactional approval/rights gates.
Existing published content is not bulk-demoted on activation. Gate deactivation
removes enforcement, retains settings/meta. Existing FF90/Hermes publishing and
kill-switch rules must remain authoritative.

Advisory mode stores recommendations without emitting canonical/schema/robots or
changing the sitemap. An SEO plugin whose signatures are unknown must declare
ownership using `ff90_seo_external_owner` or keep FF90 advisory. Do not claim
compatibility with an actual unavailable V4 product. Full-cache delivery requires
cache invalidation after publish/meta/privacy/settings changes; no CDN purge
adapter is implemented. News sitemap is uncached at origin and requires CDN
bypass or an appropriate short TTL. No external staging or production tested.
