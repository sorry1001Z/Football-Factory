=== ff90-image-registry ===
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv3 or later

Human image license/source URL, credit, expiry and exact-file declaration through native Media Library fields. SHA-256 duplicate detection, recent-use ledger (default 7 days), candidate recommendations and bounded atomic leases. Does not download images or independently establish legal rights. Exact SHA-256 plus advisory dHash/mean-color near-duplicate matching when GD is available (up to 8 MP / 10 MB); no guarantee for arbitrary crops/rotations. Visual similarity can have false positives/negatives; atomic reservation guarantees apply to exact file hash. Licensed source selection provider remains unconnected. Existing historic use is not backfilled on activation.

== Installation ==
Install this ZIP through Plugins > Add New > Upload Plugin. Install declared dependencies first. Settings/data are site-local and not coupled to a theme or a production hostname. Test on staging before enabling enforcement, workers or provider requests. Deactivation keeps data and removes enforcement for the deactivated plugin. These are first independently installable module baselines, not a guarantee that all externally named V4 functionality exists.
