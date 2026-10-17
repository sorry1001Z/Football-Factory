# FF90 menus, contact, real-data badges and advertising

## Menu icons and ติดต่อเรา

Primary-menu labels retain their native WordPress destinations. Original inline
SVG icons cover home, previews, breaking news, teams, transfers, leagues, cups
and contact, including league/cup child links. No icon font or external CDN is
required. Optional menu CSS classes `ff90-icon-home`, `ff90-icon-calendar`,
`ff90-icon-news`, `ff90-icon-team`, `ff90-icon-transfer`, `ff90-icon-football`,
`ff90-icon-cup`, `ff90-icon-contact` override the automatic choice.

Create/select a published native Contact page in Appearance → Customize →
FF90 Contact & Social. The primary menu adds ติดต่อเรา only if that destination
is not already present. Existing page content is preserved; the selected page
shows the configured public contact email after its content. No message form
or mail-sending backend is introduced. The user-authorized address is
**rom2001th@gmail.com**, configured in the local sandbox and editable in the
Customizer. Theme installation alone does not silently create production pages
or overwrite an existing site's email.

Facebook, YouTube and TikTok icons are shown as non-interactive placeholders
until their HTTPS URLs are supplied. They are spans with accessible labels,
not empty/`#` links. The user explicitly requested no links yet. Valid provider
URLs can later be entered in FF90 Contact & Social; the same icons become real
links. Unknown hosts, JavaScript, arrays and URLs containing credentials are
rejected. No social account or private identity is invented.

## Three sellable banner positions — no code editing

Appearance → Customize → **FF90 Banner Sale**:

1. **ข้างโลโก้** — choose/upload an image; recommended 468×60.
2. **คั่นกลุ่มข่าว จุดที่ 1** — choose/upload an image; recommended 970×120.
3. **คั่นกลุ่มข่าว จุดที่ 2** — choose/upload an image; recommended 970×120.

Each has an optional destination URL. Click Publish to save. Clear the image
to return to the unsold-space design. A checkbox hides empty available slots.
Images preserve their ratio and all pixels on mobile. Every active ad is
labeled โฆษณา; destination links use `rel="sponsored nofollow noopener"`.
Unset destinations produce a plain image, not a broken link.

Existing widget users may use `ff90-sale-header`, `ff90-sale-inline-1`, and
`ff90-sale-inline-2`; Customizer images take precedence, followed by assigned
widgets, followed by the available-space design. No advertising service,
tracking pixel, campaign, payment or automatic sale is connected.

Main V2 inserts one long slot between priority/latest sections and the second
between the first five and remaining latest stories. ColorMag 01 inserts the
long slots after category modules two and four. Smaller/empty sites still
render available slots honestly, without inventing additional news groups.
Header placement stays beside the logo on desktop and stacks on small phones.

## NEW / BEST / HOT

The theme renders labels; the separate, newly added **FF90 News Insights**
plugin owns popularity data. Existing Core, SEO, Analytics, WordPress content,
Hermes automation and production are not modified.

- **NEW:** public, non-password-protected news published less than 3 hours ago;
  exactly 3 hours expires. No future/draft/private post is labeled NEW. This
  time-based label also works if the optional plugin is disabled.
- **HOT:** the 5 public news posts with the most nonzero recorded page views
  in today's WordPress site-local calendar day.
- **BEST:** the top 5 for the current site-local week, Monday through today.
  Weekly count is adjustable through `ff90_insights_weekly_limit` if required.
- Ties: newer publication timestamp, then larger post ID. Posts can qualify
  for several labels. Cards/articles show all; menus show one priority ribbon
  in HOT → BEST → NEW order for a category containing qualifying news.
- No popularity label appears without real recorded events or a real analytics
  adapter. Category badges include their descendant categories. No random,
  mock, all-time or fabricated counts are used as production audience data.

Install/activate `ff90-news-insights-1.0.0.zip` separately. A new plugin was
necessary to keep the newly requested statistics logic out of the presentation
theme. It only creates its own daily aggregate table. It never updates news,
media, publishing status or an existing analytics plugin's data. Statistics
start on activation; no historical traffic is invented or backfilled.

Public document requests are deduplicated per signed first-party browser
cookie/post/site-day. Refreshing the same article does not inflate it again.
Logged-in users, previews, HEAD requests, common bots and DNT requests are
excluded. The aggregate table stores dates/post IDs/counts, not IP addresses or
visitor IDs; short-lived HMAC keys handle deduplication. This is an approximate
browser-view counter, not unique people or fraud-resistant billing analytics.
Deactivation retains totals and leaves the theme functional.

Full-page caching that bypasses WordPress, offline/PWA reading and REST-only
app requests do not pass through this server-rendered document counter. Before
claiming complete cached/app traffic, wire the real Analytics adapter through
`ff90_insights_ranking_ids($ids, $period, $start, $end)`. A consent integration
can disable collection via `ff90_insights_tracking_allowed`. This iteration
adds no PWA, service worker, push notifications or offline cache.

## QA

`tests/editorial-features.cjs` uses an explicitly marked loopback WordPress:
real HTTP requests verify deduplication and exclusions, native Customizer Media
Library/Publish controls are exercised, and both layouts/all five widths are
checked with axe. Synthetic QA story/events/banner are deleted/restored at the
end; their screenshots are test demonstrations, not audience/campaign claims.
`wordpress-plugins/ff90-news-insights/tests/contracts.php` checks ranking windows,
NEW expiry, ordering, private-post exclusion, cache invalidation and URL safety
using isolated disposable fixtures. No production or live campaign was tested.
