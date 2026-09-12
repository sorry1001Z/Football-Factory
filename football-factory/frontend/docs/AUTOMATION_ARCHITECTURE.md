# Football Factory — Automation Architecture

**Phase:** `FOOTBALL_FACTORY_FULL_INTEGRATION_AUTOMATION`

This document describes the runtime architecture for automation in the Football Factory production stack. It is the input for `n8n` workflow design and for any future orchestrator (cron / GitHub Actions / internal scheduler).

---

## 1. Goals

1. Real data from the Football Data Provider flows through automation into a WordPress draft.
2. Every automation step is **persistent** (no fire-and-forget) and **idempotent** (same input never produces a duplicate artifact).
3. Automation hooks are NOT exclusive to n8n. The orchestration surface is **pluggable**.
4. Human approval gates every publish step. Auto-publish is **NOT** a default behavior.
5. Rights review is mandatory. Football-player imagery without a defensible license must be blocked — never silently published.

---

## 2. Layered architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATORS (clients of the Internal API)                       │
│  - n8n workflow (active=false at go-live)                          │
│  - Vercel Cron / GitHub Actions cron                               │
│  - Admin manual trigger via /admin                                 │
│  - Future external automation                                      │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  INTERNAL API / JOB API (Next.js Route Handlers, server-only)      │
│  - /api/automation/deduplicate    (idempotency claim)              │
│  - /api/automation/editorial-item  (creates editorial row)         │
│  - /api/automation/ai-assist       (provider_status, audit)         │
│  - /api/automation/fact-check      (provider_status, pending_manual)│
│  - /api/automation/rights-check    (manual_review default)         │
│  - /api/automation/seo-check       (deterministic local checks)    │
│  - /api/automation/wp-draft        (POST → WP draft only)           │
│  - /api/automation/wp-publish      (gated by approval+rights+stage)│
│  - /api/automation/approval-status (current approval state)        │
│  - /api/automation/log             (audit_logs persistence)        │
│  - /api/automation/alert           (persisted severity events)      │
│  - /api/admin/automation/[runId]   (admin reads; session+role)     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  DOMAIN SERVICE LAYER                                              │
│  - FootballService (lib/football/football-service.ts)              │
│  - WordPressClient (lib/wordpress/client.ts) + WP write client     │
│  - AuthService (lib/auth/auth-service.ts)                          │
│  - ImageSystem: policy.ts + url-canonical + dedupe + freshness     │
│              + banner-composer                                     │
│  - BannerComposer (lib/image-system/banner-composer/)              │
│  - SEO V3 (lib/seo-v3/)                                            │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  ADAPTERS / PROVIDERS                                              │
│  - football-data.org / api-football / mock                         │
│  - WPGraphQL endpoint                                              │
│  - WordPress REST write                                            │
│  - AI Assist provider (deferred)                                   │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                        │
│  - Postgres (lib/db/postgres.ts) — application data, automation    │
│  - WordPress (external) — content (articles, categories, media)    │
│  - Memory cache (per-process) for football responses               │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Job lifecycle

Every automation run goes through these states. The state machine is forward-only along the canonical pipeline; failure paths are explicit.

```
QUEUED
  ↓
RUNNING
  ↓ (transient)
RETRYING (transient: timeout/network/upstream_temporary/wp_retryable)
  ↓ (all retries exhausted)
FAILED
  ↓
  └── (caller decides; retry-policy.ts refuses `rerun_stage` from terminal states
      unless a transient error class is recorded and the stage is non-terminal)

WAITING_APPROVAL (after wp-draft succeeds; not a terminal state)
  ↓ (human approval + rights cleared)
APPROVED
  ↓ (next wp-publish)
PUBLISHED (terminal)

REJECTED (terminal — from any stage)
CANCELLED (terminal — admin-triggered)
```

Every run has these persisted fields in `automation_runs`:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `idempotency_key` | text UNIQUE | Caller-supplied; rejects duplicates at DB level |
| `workflow` | text | e.g. `editorial_draft`, `data_sync`, `banner_prep` |
| `status` | enum | `running | success | failed | waiting_approval | rejected` |
| `stage` | text | Current pipeline stage (matches editorial pipeline) |
| `input` | jsonb | Caller payload |
| `output` | jsonb | Stage outputs (e.g. `editorial_item_id`, `wp_post_id`) |
| `error` | text | Last error message (redacted) |
| `error_class` | text | `timeout | network | upstream_temporary | wp_retryable | auth | validation | rights_rejected | approval_rejected | association_mismatch | ownership_mismatch` |
| `editorial_item_id` | uuid FK | Linked editorial row (nullable until FF_HOOK_3) |
| `wp_post_id` | bigint | Linked WP post (nullable until wp-draft) |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz | |
| `retry_count` | int | 0 by default; incremented by retry route |
| `metadata` | jsonb | Free-form per-stage metadata |

---

## 4. Idempotency model

- **Dedupe key (REQUIRED)**: `idempotency_key` is `UNIQUE` at the DB level. Concurrent submissions with the same key resolve to one INSERT; subsequent attempts return `{ duplicate: true, run_id: <existing> }`.
- **Content hash (per stage)**: when an automation stage takes content payload, the body computes `sha256(...)` and only updates the stage metadata when the hash differs.
- **WP-side dedupe**: `editorial_items.source_id` is `UNIQUE`. Repeated attempts with the same `source_id` return the same `editorial_item_id`.

**Test pattern**: `same request ×2 → exactly one INSERT; second call returns duplicate=true`.

---

## 5. Approval & rights gates (HARD gates)

`wp-publish` requires ALL of:

1. `run_id` exists.
2. `run.editorial_item_id IS NOT NULL` (otherwise `409 editorial_link_missing`).
3. `editorial_items.wp_post_id == body.wp_post_id` (otherwise `409 wp_post_mismatch`).
4. `editorial_items.approval_state == 'approved'` (otherwise `409 approval_not_granted`).
5. `editorial_items.rights_confirmed == true` (otherwise `409 rights_not_cleared`).
6. `editorial_items.stage == 'approved'` (otherwise `409 stage_not_approved`).

If any gate fails, the run is NOT marked `failed` for `rights_not_cleared` or `stage_not_approved` — those are recoverable 409s. The caller can retry after legitimate rights clearance or stage advancement.

`approval_state` and `stage` are independent columns:

- `stage` = position in the canonical pipeline.
- `approval_state` = explicit human decision (`pending | approved | rejected`).

A draft can be at stage `draft_created` AND approval_state `approved` — that means "ready to publish". `wp-publish` advances stage to `published` (terminal).

---

## 6. Retry policy

`lib/automation/retry-policy.ts::evaluateRetry()` returns:

```
ELIGIBLE:          retry allowed for transient errors on non-terminal stages
REFUSED_REJECTED:  approval_state=rejected → permanent
REFUSED_PUBLISHED: stage=published → terminal, no retry
REFUSED_TERMINAL:  stage=rejected|failed → terminal, no retry
REFUSED_RIGHTS:    rights_confirmed=false AND stage past rights_check
                    → must clear rights first
REFUSED_PERMANENT: errorClass in {auth, validation, rights_rejected,
                                   approval_rejected, association_mismatch,
                                   ownership_mismatch}
```

Retry never advances stage; it only re-emits `rerun_stage`. This means a retry does not skip fact-check or rights-check just because the previous run succeeded.

---

## 7. Failure & recovery

| Failure | Persistence | Retry behavior |
|---|---|---|
| Football API timeout | `error_class=timeout, stage unchanged, status=running→retrying` | Up to 3 retries with backoff; final `failed` if exhausted |
| CMS unavailable | `error_class=wp_retryable, stage unchanged` | Up to 3 retries; otherwise `failed` |
| Image / banner failure | `error_class=upstream_temporary, stage unchanged` | Retry |
| DB failure | `error_class=network` (when reachable) or `internal` (terminal) | Retry for transient; permanent otherwise |
| Malformed input | `error_class=validation, status=failed` | Refused — no retry |
| Association mismatch | `error_class=association_mismatch` | Refused |

In all cases, `audit_logs` records the failure with redacted metadata (no credentials, no PII, no query bodies).

---

## 8. Orchestrator (n8n) integration

`n8n/football-factory-production-expansion.json` is the workflow definition. It is currently `active=false`. When activated:

- It runs as a client of the Internal API.
- It does NOT call the database directly.
- It does NOT call WordPress directly except via the route handlers.
- It does NOT bypass admin/approval gates.

The Internal API is the single contract surface. Replacing n8n with another orchestrator (cron, GitHub Actions, internal scheduler) is a wiring change, not a code change.

---

## 9. Admin surface (planned)

For each `automation_runs` row, the admin surface must show:

- Run ID, workflow, status, stage
- Started/finished timestamps, duration
- Retry count, error class, error message (redacted)
- Editorial item link (if present)
- WP post link (if present)
- Audit log of recent events

Actions (when supported by policy):

- **Retry**: only when `evaluateRetry() === ELIGIBLE`. Returns `409` otherwise.
- **Cancel**: only when stage is non-terminal. Marks `cancelled`.
- **View Details**: opens the timeline + audit log.

The current `components/admin/{queue,run,timeline}.tsx` already covers this for the editorial pipeline. The full automation dashboard wiring (FF_HOOK_1..8 surface) is the next UI slice.

---

## 10. Operational posture

- Every automation run is auditable end-to-end.
- No fire-and-forget runs. Every state transition persists before the next call begins.
- Idempotency guaranteed at three layers: API dedupe, content hash, source_id uniqueness.
- Rights + approval gates are HARD; the publish route refuses to bypass.
- Retry policy refuses to advance stage from terminal states.
- Automation secret + AUTH_SECRET are placeholder-rejected.
- Body cap enforced; rate limit enforced per IP for auth routes.
- CSRF enforced for cookie-authenticated state changes.
