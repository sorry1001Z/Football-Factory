# FF90 — Staging readiness & guarded E2E runbook (2026-10-20)

Status: **BLOCKED — documentation and gates prepared, no live mutation**.
Scope: `sorry1001Z/Football-Factory`. Do not deploy to `wp.ff90.online` until verified as a separate, disposable staging installation. No DNS, production DB, uploads, posts, media or secrets may be changed by this runbook.

## Invariants (non-negotiable)
- `AUTOMATION_DRAFT_ENABLED=false`, `AUTO_PUBLISH_DISABLED=true`, `QUEUE_ENABLED=false`, kill switch engaged.
- Automation account cannot publish, schedule, privatize, delete or edit published posts, even if caller tampers with requests.
- WordPress write client rejects `pending`, `future`, `private`, `publish` **before HTTP**. Enforce same policy in WordPress endpoint via capabilities; client guard alone is insufficient.
- No generated synthetic journalism or non-cleared image may appear as a real event/photo. Every photo requires rights evidence and subject/context checks.
- WordPress Draft E2E allowed only after backup/restore, isolation, connector access, scoped service identity, server-side QC evidence, and image permissions all pass.

## Gate A: Separate staging & restore proof
1. Confirm staging URL and site identity are *distinct* from production, with separate DB, upload root, credentials, API keys, mail provider and job queue. Disable outgoing email/webhooks and indexing; require auth for access.
2. Capture an authorized backup of production database and uploads, retaining checksums, archive sizes, timestamp and encrypted secret location. Do not save backup archives in Git.
3. Restore to **isolated staging** (never to production); record checksums, sample media/openable attachments, schema version, counts and evidence that no production URL/DB references remain after safe URL rewriting.
4. Perform a staging-only destructive restore rehearsal, verify rollback and restoration of post/media links. Obtain operator approval.
5. If any identity/restore check fails: STOP, don't attempt any WordPress writes.

Evidence: `STAGING_URL`, `SITE_URL`, `DB_INSTANCE_ID`, `UPLOAD_ROOT`, backup checksum/time, restore test log/checksum, approved operator/time. **Do not include credentials**.

## Gate B: Connector
- Current WPWriter inventory shows **one site**, `https://wp.ff90.online`. Listing installed plugins returned an instruction to update the connector. This is **not** proof that the target site is staging.
- Update connector only after backup on the designated staging instance. Read plugins, themes, REST status, WP version, user capability information and installed FF90 automation/SEO plugin versions.
- Record exact plugin names, versions and endpoint behavior. Do not infer an active FF90 plugin from source files alone.

## Gate C: Staging service user & least privilege
- Provision `ff90_automation_agent` on staging only; use a custom role with **only** `read`, `edit_posts`, `upload_files` and needed scoped custom caps. `publish_posts`, `edit_published_posts`, `delete_posts`, `manage_options`, `unfiltered_html` must be absent. Evaluate whether `edit_posts` lets editing other drafts; add ownership enforcement.
- Generate an Application Password on staging, store in secret manager; never commit or paste to chat, issue logs or evidence.
- Test privilege denial for publish/future/private/pending, changes to existing production posts, unrelated media and direct REST endpoints.
- Transport HTTPS; identify service user and staging host with allowlist at worker. Revoke secret after test if not continuing.

## Gate D: Editorial, image and SEO contract
- Use **FF90 Sports Editorial V2.5.2** for STANDARD 2,500–3,500 Thai characters; verify original counting rules before enabling.
- Image: one approved subject-matched clean photo per article, **1200×675 hero**, WordPress-derived **640×360 card**; no text overlays. This is later-approved image policy and supersedes earlier theme blueprint 1280×720; run active theme layout compatibility checks.
- Primary player/person shown in headline first; license must explicitly allow site use and required adaptations, with source/creator/credit/rights evidence. No generic stadium automatic fallback.
- QC is server-verifiable, not caller-supplied `PASS` flags. Require signed or server-side immutable `qc_run_id` binding article body hash, source evidence, subject identity, image ID/rights record, SEO validation and current policy version.
- Block unsupported article-type profiles (transfers, match reports, etc.) pending approved contracts. For these, perform **read-only or fixture/mock tests**, not live Draft writes.
- Enforce atomic idempotency key uniqueness server-side and read-back after Draft create. Audit transitions.
- SEO: check single canonical/schema writer in actual installed SEO plugins; verify title/meta, category, internal links and read-back.
- Approval remains manual in WP editor.

## Gate E: Hermes + MiniMax M3 sandbox test
- Disable schedules and live source writes. Generate a single test Article Package with source URLs, timestamps, factual claims/evidence, player/entity identity, rights-cleared WP Media ID, SEO payload, policy version and QC run ID.
- Verify independent source checks, license evidence, char count and safety gates. Do not forge a license/image or use fabricated game reports.
- If no rights-cleared media is available, return `IMAGE_REVIEW_REQUIRED` and no Draft attempt.

## Gate F: WordPress Draft-only E2E
Prerequisites: Gates A–E all PASS, user-authorized staging URL.
1. One STANDARD article with fully verified content, image and QC record; POST as `draft` only.
2. Read post back through authenticated WP REST: status=draft, exact title/body/SEO, valid media ID and original credit.
3. Preview at desktop and 360/390px; card 640×360 derived from hero, subject visible; no generic fallback.
4. Test replay (one draft), concurrent requests (one draft), invalid rights, mismatched subject, short content, alternate statuses and unavailable provider (all fail closed).
5. Record staging Post ID, Preview URL, timestamp, redacted request/response, screenshots, pass/fail and cleanup/rollback.
6. STOP without promoting config or deploying to production.

## Stage table (current)
| Gate | State | Required next evidence |
|---|---|---|
| A Backup + separate restore | BLOCKED | staging identity, backup and restore rehearsal |
| B Connector plugin inspection | BLOCKED | connector update and successful list |
| C Service identity | BLOCKED | least-privilege role/capability report |
| D QC/Image/SEO | BLOCKED | immutable evidence read-back, verified rights |
| E Hermes/MiniMax | NOT RUN | sandbox Article Package |
| F Draft-only staging E2E | NOT RUN | prior passes + preview |

## Codex execution contract
Work only in new feature branch/PR. First implement read-only site identity and backup/restore verification; never self-approve gates. Mark `PASS`, `FAIL`, or `NOT RUN` with evidence. Missing prerequisites are blockers, not reasons to use production. Fix missing ZIP fixture with correct source or keep test failing; never invent it. No queue activation, Auto Publish, public test news or deployment without explicit authorization.
