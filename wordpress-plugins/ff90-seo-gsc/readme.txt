=== FF90 SEO Search Console Connector ===
Requires at least: 6.5
Requires PHP: 7.4
Requires Plugins: ff90-seo
Stable tag: 0.1.0
License: GPLv3 or later

Optional read-only Google Search Console connector. Requires sodium encryption and base SEO 0.2.0+.
Configure FF90_GSC_CLIENT_ID and FF90_GSC_CLIENT_SECRET in environment or wp-config.php. Requires a real Google Cloud OAuth Web client with Search Console API enabled and authorized redirect URI displayed in Settings > FF90 Search Console.
Connect Google, select an accessible property, then fetch real metrics. Account consent and actual verified property permissions must be provided by the operator.
OAuth uses user/session-bound single-use state, PKCE and readonly scope. Tokens encrypted in per-site nonautoloaded options. Salt rotation requires reconnect. No secrets are returned by REST or shown in editor.
Admin-only POST /wp-json/ff90-gsc/v1/metrics accepts from/to, optional post_id and limit (1..10000); property selected server-side. Results include source/fetchedAt/truncated. Query/page dimensions, final data; no previous-period/index coverage invented.
Disconnect clears local tokens and requests Google revocation; if network unavailable, revoke app access in Google account. Deactivation retains encrypted connection data.
No Google Indexing API, external content analysis, tracking script, mock production metrics, automatic publication or cron.
Live Google verification NOT_RUN until real OAuth configuration and consent/property access are supplied. HTTP test doubles do not count as live verification.
