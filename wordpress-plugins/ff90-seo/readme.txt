=== FF90 Modular SEO ===
Contributors: ff90-contributors
Requires at least: 6.5
Requires PHP: 7.4
Tested up to: 6.9
Stable tag: 0.2.0
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Local PHP SEO analysis and native WordPress editor integration. V3 policy port with optional domain and GSC plugins; not a complete V4 product.

== Installation ==
1. Install ZIP through Plugins > Add New > Upload Plugin, then activate.
2. Default is advisory: existing SEO remains responsible for public output.
3. Settings > FF90 SEO: choose standalone only when this plugin should own singular metadata and news sitemap. Recognized competing SEO plugins take precedence.
4. Open FF90 SEO in Gutenberg document sidebar, or saved-content meta box in Classic Editor.
5. Leave canonical override empty to use the actual native permalink. No manual override is required.
6. Optional structural publish gate is OFF initially. Enable only after reviewing your theme's H1 behavior on staging.

== Sitemaps ==
Native WordPress sitemap: /wp-sitemap.xml (or native query-string sitemap on plain permalinks).
News: /ff90-news-sitemap.xml in standalone mode with pretty permalinks.
Plain-permalink fallback: /?ff90_news_sitemap=1.
Last 48 hours, published posts without passwords/noindex, 1000 URLs per child file. More URLs produce a sitemap index. Indexing/Google News appearance is not guaranteed.

== Limits ==
Intent, deep quality and graph validation are local. Optional ff90-seo-football supplies domain identities; ff90-seo-gsc supplies OAuth and metrics. Live Google/account/provider verification remains separate.
No fake GSC data or automatic Indexing API submission. No fact-checking claim.
Theme title H1 is assumed by default and configurable. Thai counts are heuristic warnings.
Native NewsArticle/WebPage output; domain schema candidates are advisory. No invented SportsEvent/Person data.
No external analysis service or frontend tracking script.
Settings/meta retained on deactivation; no uninstall data deletion.
