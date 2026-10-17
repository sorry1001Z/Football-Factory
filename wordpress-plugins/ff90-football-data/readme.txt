=== ff90-football-data ===
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv3 or later

football-data.org v4 provider only. Set FF90_FOOTBALL_DATA_TOKEN in environment/wp-config.php, enable provider in Settings > FF90 Football Data, choose competition. Disabled initially; no activation requests. Source labels, site-timezone date filtering, cache, explicit stale data, daily quota and refresh lock. No real provider tested or invented scores. API-Football alternative is not ported in this package.

== Installation ==
Install this ZIP through Plugins > Add New > Upload Plugin. Install declared dependencies first. Settings/data are site-local and not coupled to a theme or a production hostname. Test on staging before enabling enforcement, workers or provider requests. Deactivation keeps data and removes enforcement for the deactivated plugin. These are first independently installable module baselines, not a guarantee that all externally named V4 functionality exists.
