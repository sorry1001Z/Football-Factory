=== ff90-operations ===
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv3 or later

Private admin health and native WordPress WXR content export with checksum. Configure FF90_BACKUP_DIR outside all webroots, writable privately by PHP. No public uploads fallback. WXR does not contain actual media bytes, full database, users/options/configuration. No restore engine, full disaster recovery, SaaS monitoring or scheduled/offsite backup is claimed. Full backup/restore provider and real restore drill remain required. Existing FF90 News Insights supplies basic analytics separately.

== Installation ==
Install this ZIP through Plugins > Add New > Upload Plugin. Install declared dependencies first. Settings/data are site-local and not coupled to a theme or a production hostname. Test on staging before enabling enforcement, workers or provider requests. Deactivation keeps data and removes enforcement for the deactivated plugin. These are first independently installable module baselines, not a guarantee that all externally named V4 functionality exists.
