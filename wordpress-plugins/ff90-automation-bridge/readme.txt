=== ff90-automation-bridge ===
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv3 or later

Authenticated native WP REST inbox and recovery, using Application Passwords over HTTPS. POST /wp-json/ff90-automation/v1/jobs: key, task, payload. Tasks content_qa, football_sync, handoff. Unique idempotency keys, actor/object permissions, lease token, bounded retries/recovery. Worker off initially. Enable five-minute cron in Settings > FF90 Automation only when ready. Never publishes; content_qa stops at waiting_review. Handoff awaits explicitly installed n8n/Hermes handler. No original workflow edited. Real n8n, cron and end-to-end delivery NOT_RUN.

== Installation ==
Install this ZIP through Plugins > Add New > Upload Plugin. Install declared dependencies first. Settings/data are site-local and not coupled to a theme or a production hostname. Test on staging before enabling enforcement, workers or provider requests. Deactivation keeps data and removes enforcement for the deactivated plugin. These are first independently installable module baselines, not a guarantee that all externally named V4 functionality exists.
