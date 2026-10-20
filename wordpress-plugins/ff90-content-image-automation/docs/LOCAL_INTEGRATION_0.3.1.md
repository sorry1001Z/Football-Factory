# Local integration 0.3.1

User supplied FF90_Content_Image_Automation_0.3.0_SAFE.zip; original retained outside Git. SHA-256: e23dcf70e67afa38c40d71afcf974ae968f9919546718a72f43915348112ff9d

Compatibility patch: own ff90-content-image-automation admin slug; no collision with existing ff90-automation Inbox. Require nonblank string clean master, strict subject/dimensions booleans and an explicit article_type. Description matches actual read-only status/blocked preflight behavior. No publisher/worker/image rendering has been added.

Verified 22 pure validation assertions, 12 native WordPress assertions and 6 browser integration cases in an isolated disposable clone. Existing job routes/admin page coexist. Both anonymous requests denied; authenticated nonce-backed preflight always 422 without draft creation. 24 pre-existing draft previews remain admin-only and post content/status remain unchanged on the main local site. Broader website results: modules/ff90/docs/FULL_SITE_QA_2026-10-20_TH.md.

This control plane is not the global kill switch for the old Automation Bridge. That worker is independently OFF. Full-image creation, provider MiniMax/Hermes authentication, authoritative editorial profiles and migration of validators to one workflow remain unimplemented/unverified. 1200x675 and old 1280x720 are both 16:9 but existing theme image tests do not prove the new pixel rendering/rights/readability pipeline, which is not implemented here.
