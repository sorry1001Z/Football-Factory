=== FF90 News Insights ===
Contributors: ff90
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv3 or later

First-party, aggregate page-view ranking for the FF90 theme. No external tracking,
IP storage, fabricated audience counts or production configuration changes.

NEW: published less than three hours ago. HOT: five highest nonzero view totals
for the current site-local calendar day. BEST: five highest totals Monday through
today in the current site-local week. Ties: newer publication, then larger ID.

Activate separately. Only public, non-password-protected posts are counted.
Logged-in readers, previews, bots, empty user agents and DNT requests are skipped.
A signed HttpOnly SameSite=Lax first-party cookie deduplicates each browser/post/
site-day. Database stores daily totals, not visitor identifiers. Temporary HMAC
keys deduplicate requests. These totals are approximate browser views, not unique
people, a fraud-resistant ad audience, or independently audited analytics.

Full-page cache that bypasses WordPress also bypasses this request counter.
For cached production sites integrate the real Analytics provider through
ff90_insights_ranking_ids; do not claim full traffic coverage without doing so.
Consent integrations can return false from ff90_insights_tracking_allowed.

No arbitrary HTTP write endpoint is exposed. Tables and totals are retained on
deactivation; no news, media or existing analytics data are deleted. Re-activation
uses idempotent dbDelta. Rankings refresh at most every 60 seconds.

Copyright 2026 FF90 Contributors. GPL-3.0-or-later. No warranty.
