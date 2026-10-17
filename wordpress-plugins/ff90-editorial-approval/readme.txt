=== ff90-editorial-approval ===
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv3 or later

Requires FF90 Content QA. Activation is advisory. Settings > FF90 Editorial enables ordinary WordPress/REST publishing and scheduled-publication preflight; pause stops those paths. Independent QA and editorial approval must match current content. Includes private history and explicit ff90_editorial_publish() helper. Trusted PHP direct wp_publish_post/SQL can bypass preflight: integrate publishers with the helper; this is not a sandbox around privileged code. No bulk modification of existing posts on activation.

== Installation ==
Install this ZIP through Plugins > Add New > Upload Plugin. Install declared dependencies first. Settings/data are site-local and not coupled to a theme or a production hostname. Test on staging before enabling enforcement, workers or provider requests. Deactivation keeps data and removes enforcement for the deactivated plugin. These are first independently installable module baselines, not a guarantee that all externally named V4 functionality exists.
