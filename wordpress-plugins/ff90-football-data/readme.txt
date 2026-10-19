=== ff90-football-data ===
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 0.3.0
License: GPLv3 or later

football-data.org v4 and direct API-Football v3 providers. Set FF90_FOOTBALL_DATA_TOKEN in environment/wp-config.php, enable provider in Settings > FF90 Football Data, choose competition. Disabled initially; no activation requests. Source labels, site-timezone date filtering, cache, explicit stale data, daily quota and refresh lock. Real API-Football Free status, current-date fixtures, and restricted/allowed standings were checked on local WordPress on 2026-10-18; no invented scores. API-Football: API_FOOTBALL_KEY in server configuration, provider selector, 80 attempts/day UTC hard cap, shared all-league fixtures cache 1 hour, standings 6 hours, null scores preserved, explicit HTTP-200 plan errors and no paid upgrade. Season is selected explicitly and labelled; Account verified Free active 100/day. Current PL standings 2026 denied (API instructs 2022-2024); 2024 tested successfully. Not all leagues/cups/plan features verified. Content automation is not enabled.

== Installation ==
Install this ZIP through Plugins > Add New > Upload Plugin. Install declared dependencies first. Settings/data are site-local and not coupled to a theme or a production hostname. Test on staging before enabling enforcement, workers or provider requests. Deactivation keeps data and removes enforcement for the deactivated plugin. These are first independently installable module baselines, not a guarantee that all externally named V4 functionality exists.

== 0.3.0 Split standings ==
Choose football-data.org as the separate standings provider while keeping API-Football fixtures/results. Five intended league codes, credential-scoped cache, 6h shared standings cache, explicit source-season labels, bounded daily quota and negative cache. The first football-data.org live check was blocked by cloud proxy CONNECT 403 on 2026-10-19; key validity, plan and five-league entitlement are NOT_VERIFIED. Keep standings source unchanged until live verification succeeds.
