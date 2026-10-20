=== FF90 Content & Image Automation ===
Requires at least: 6.5
Requires PHP: 8.0
Stable tag: 0.3.1
License: GPLv2 or later

Local compatibility patch of the user-supplied 0.3.0 SAFE package. Adds a separate FF90 Content & Image admin menu; original Automation Bridge remains unchanged. Queue OFF, Auto Publish OFF, Kill Switch ON. Status requires administrator; preflight requires edit_posts and deliberately returns 422. No scheduler, external AI calls, media upload, image rendering, news rewriting, draft creation or publishing. Does not modify existing drafts.

== Changes ==
0.3.1: avoid existing admin slug collision; require a nonempty clean master in image_contract, strict boolean subject/dimension attestation and explicit article type. These validate metadata only, not actual facts, rights, dimensions or readability. Header updated to describe actual scope. Other profile/SEO/image integration work remains pending.
