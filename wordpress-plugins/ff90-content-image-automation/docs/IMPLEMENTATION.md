# FF90 Automation — Implementation Contract (safe starter 0.1.0)

## What is delivered
- Installable standalone WordPress plugin with read-only admin control panel and authenticated REST status/preflight endpoints.
- Hardcoded fail-closed daily_target=40, provider=minimax via Hermes, queue OFF, kill switch ON, auto-publish OFF, manual review ON, draft-only.
- Preflight checks for source URL, provenance, rights evidence, subject verification, 1280x720 hero and stable idempotency key; it **always** blocks production operations until legacy rule imports and external validations are wired.
- No scheduled tasks, outbound calls, publication, database migrations, data deletion or edits to existing FF90 drafts.

## Verified from GitHub FF90 dual layout blueprint (2026-10-17)
- Featured media externally prepared/attached: 1280×720 WebP or PNG, thirteen visual classes.
- Theme A `main-v2` / B `colormag-01`; theme does not produce SEO or publish posts.
- Production deploy requires explicit approval.

## Still unresolved: authoritative values required before enabling
- Article length (by category), article outline/format, SEO title/meta numeric bounds and scoring rubric.
- Card resolution/aspect and safe-area rules from final theme.
- Full QC hard/soft gate scoring; existing QC config location/source of truth.
- Actual installed SEO plugin meta keys; provider authorization/cost limits.
- Neon migrations, active inflight jobs and WordPress media/backup permissions.

## Target end-to-end pipeline (not yet delivered)
RSS & licensed sources -> Dedup & evidence -> Hermes/MiniMax -> Editorial QC -> Image search/rights & transform -> SEO checks -> Approval queue -> WordPress **draft only**. n8n handles orchestration only after operator enables an approved deployment; plugin is the control panel, not the heavy worker.

## Acceptance requirements
1. Read legacy QC source and write versioned schema with tests; no invented defaults.
2. Create non-public worker API with strong authentication, short-lived credentials and audit trail.
3. Idempotent draft creation, no modification to already published posts.
4. Image origin/license ledger; block placeholders, wrong person/event, missing attribution.
5. SEO schema/canonical produced once, avoiding duplicate plugin/theme output.
6. Staging: fixtures and integrated QA for 10, then 20, then 40 stories; backup/rollback and approvals before production.
7. Never allow queue_enabled or auto_publish to become true in phase 1. No image generation representing real football events.

## Installation
Zip folder `ff90-content-image-automation`, upload in WordPress Admin > Plugins > Add New > Upload Plugin. Activate only on staging first. Admins can visit `FF90 Automation`. `GET /wp-json/ff90-automation/v1/status` requires WordPress-authenticated admin. `POST /wp-json/ff90-automation/v1/preflight` requires post-edit rights and returns HTTP 422 until full integrations are validated. No write endpoints are registered.
