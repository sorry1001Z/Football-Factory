=== ff90-security ===
Requires at least: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv3 or later

Login throttling (5 failed attempts per IP/login pair per fixed 15-minute window), security headers, private minimal audit. No WAF, malware scanner, MFA or claim of complete external Security V4 parity. Native Application Passwords remain enabled. Audit retention housekeeping runs on login failures. Headers may be disabled through ff90_security_headers_enabled for embedding requirements.

== Installation ==
Install this ZIP through Plugins > Add New > Upload Plugin. Install declared dependencies first. Settings/data are site-local and not coupled to a theme or a production hostname. Test on staging before enabling enforcement, workers or provider requests. Deactivation keeps data and removes enforcement for the deactivated plugin. These are first independently installable module baselines, not a guarantee that all externally named V4 functionality exists.
