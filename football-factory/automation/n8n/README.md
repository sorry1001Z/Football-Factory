# FF90 n8n automation — Phase 18A

Local-only n8n workflow workspace for the FF90 news automation pipeline.
**No live activation in Phase 18A.** Every workflow ships with
`"active": false` and is intended to be imported as INACTIVE until a
later brief explicitly authorizes production activation.

## Policy

```
PUBLISH_MODE_DEFAULT       = manual_review
AUTO_PUBLISH               = OFF
REVIEW_TIMEOUT_AUTO_PASS   = OFF
HUMAN_APPROVAL_REQUIRED    = YES
```

## Architecture

```
FF90-MASTER
  └─► FF90-01 Source Intake          (POST /api/automation/deduplicate, then /editorial-item)
  └─► FF90-02 Editorial Factory      (POST /api/automation/ai-assist + seo-check + fact-check)
  └─► FF90-03 Image Factory          (provider adapter → rights-check → visual relevance → derivatives)
  └─► FF90-04 WordPress Draft        (POST /api/automation/wp-draft, status hard-coded 'draft')
  └─► FF90-05 Human Review Gate      (POST /api/automation/alert; WAIT for explicit decision)
```

Every stage returns the canonical envelope:

```json
{
  "editorial_item_id": "...",
  "automation_run_id": "...",
  "stage": "...",
  "status": "...",
  "error_code": null,
  "retryable": false,
  "timestamp": "..."
}
```

On error, downstream stages are NOT executed. No half-built items.

## Existing FF90 contracts reused (no new endpoints invented)

| Workflow node                  | Existing route                                |
|--------------------------------|-----------------------------------------------|
| POST /api/automation/deduplicate | `app/api/automation/deduplicate/route.ts`    |
| POST /api/automation/editorial-item | `app/api/automation/editorial-item/route.ts` |
| POST /api/automation/ai-assist  | `app/api/automation/ai-assist/route.ts`        |
| POST /api/automation/seo-check  | `app/api/automation/seo-check/route.ts`        |
| POST /api/automation/fact-check | `app/api/automation/fact-check/route.ts`       |
| POST /api/automation/rights-check | `app/api/automation/rights-check/route.ts`    |
| POST /api/automation/wp-draft   | `app/api/automation/wp-draft/route.ts`         |
| POST /api/admin/posts/media     | `app/api/admin/posts/media/route.ts` (Phase 17D)|
| POST /api/automation/alert      | `app/api/automation/alert/route.ts`           |
| POST /api/automation/log        | `app/api/automation/log/route.ts`             |

All server-to-server calls use `x-automation-secret` (env-driven).
No browser cookies. No JWTs. No human passwords.

## Publish-mode state machine

```
PUBLISH_MODE env var
  ├── missing          → manual_review  (fail-closed)
  ├── "manual_review"   → manual_review  (Phase 18A)
  ├── "timeout_auto"    → manual_review  (Phase 18A, ignored)
  └── "full_auto"       → manual_review  (Phase 18A, ignored)
```

Phase 18A architecture supports the future modes but never honors them.
No timeout auto-pass. No auto-publish. No 1-hour window.

## Visual relevance gate

Image rights alone are NOT enough. The cover must communicate the news:

- RESULT / PREVIEW / TRANSFER / BREAKING — include team identity through
  permitted treatment, score, headline, key event.
- AI-generated covers must NEVER be presented as documentary evidence
  of the actual match (caption explicitly says "illustrative").

## Workflow file format

Each `*.json` in `workflows/` follows the n8n workflow export schema:

```json
{
  "name": "FF90-XX",
  "nodes": [...],
  "connections": { "<source-node>": { "main": [[ { "node": "...", "type": "main", "index": 0 } ]] } },
  "active": false,
  "settings": { "executionOrder": "v1" },
  "tags": [{ "name": "ff90" }, { "name": "phase-18a" }],
  "id": "ff90-XX",
  "versionId": "1.0.0"
}
```

## Contracts

JSON Schema Draft-07 contracts live in `contracts/`:

- `source.schema.json`     — normalized job accepted by FF90-MASTER webhook + FF90-01
- `editorial.schema.json`  — fields produced by FF90-02, consumed by FF90-04
- `image.schema.json`      — image asset metadata, with a branch enforcing
                            `ai_generated → no fake author/license`
- `review.schema.json`     — human-review notification payload
- `quality-metrics.schema.json` — per-item quality signals (see Quality metrics)

## Fixtures

Five normalized source jobs (one per news type) in `fixtures/`:

- `result-news.json`
- `preview-news.json`
- `analysis-news.json`
- `transfer-news.json`
- `breaking-news.json`

## Tests

`tests/workflow-dry-run.test.ts` — 30 file-content + structural assertions:

- All 6 workflow JSON files parse and have required top-level fields
- `active: false` enforced on every workflow
- MASTER orchestrator wires 01 → 02 → 03 → 04 → 05 in that order
- `STOP` branch in master prevents duplicate editorial creation
- FF90-01 dedupe reuses `/api/automation/deduplicate`
- Source ID is computed deterministically (sha256 over canonical_url + published_at)
- FF90-02 article prompt forbids padding + invented quotes/stats
- FF90-03 provider adapter fails closed when `IMAGE_PROVIDER_STATUS != CONFIGURED`
- FF90-03 visual relevance gate is its own node
- FF90-04 NEVER calls `/wp-publish` or sets `status=publish`
- FF90-04 missing image asset → `held_for_human` (not silent skip)
- FF90-05 publish-mode is fail-closed to `manual_review`
- FF90-05 wait node has NO self-advancing timer (no setTimeout, no Date.now()+3600)
- FF90-05 APPROVE branch sets `approval_method=manual` and never calls `wp-publish`
- FF90-05 REJECT branch records reason and does NOT publish
- Manual mode no-response → `waiting_human_review` indefinitely
- Timeout_auto + full_auto branches described but NOT honored
- No workflow JSON contains a credential literal (only `$env` references)
- All 5 fixtures match their declared news_type
- All 4 contracts are valid JSON Schema Draft-07

Run from the frontend directory (which has tsx and the node:test runner):

```
cd football-factory/frontend
node --conditions=react-server --import tsx --test ../automation/n8n/tests/workflow-dry-run.test.ts
```

## What Phase 18A does NOT do

- Does NOT activate n8n workflows against production
- Does NOT set `AUTOMATION_ENABLED=true`
- Does NOT import n8n workflows (local machine only — the user can import as INACTIVE if they have a local n8n)
- Does NOT create real editorial items from these workflows
- Does NOT publish any real news
- Does NOT change the existing `lib/automation/auth.ts`, `kill-switch.ts`, `retry-policy.ts`, or any `/api/automation/*` route
- Does NOT touch config.yml, Phase 15 baseline, news/[slug]/page.tsx, prompt-factory-v2/*, branding assets, or any unrelated dirty worktree item

## Quality metrics (tracked, NEVER auto-switch publish mode)

For every editorial item we record booleans:

- `human_edited_title`
- `human_edited_body`
- `human_changed_image`
- `human_changed_seo`
- `human_changed_fact`
- `human_rejected`
- `critical_error`

These are aggregated (out of scope of this slice) to:

- `HUMAN_EDIT_RATE`   = items with any human edit / total items
- `HUMAN_REJECT_RATE` = items rejected / total items
- `CRITICAL_ERROR_RATE` = items with critical_error / total items

The contract is `contracts/quality-metrics.schema.json`. No Phase 18A
node reads these fields to switch publish mode automatically. The
`Resolve publish mode` node reads ONLY `PUBLISH_MODE` (env) and the
field is NEVER written by the workflow itself — only the operator
can change `PUBLISH_MODE`. Future activation of `timeout_auto` or
`full_auto` is a config flip, never a metric-driven switch.

## Future activation

To move from Phase 18A to a later phase:

1. Operator confirms the dry-run suite stays green.
2. Operator sets `AUTOMATION_ENABLED=true` in Vercel (fail-closed until then).
3. Operator imports the workflows into n8n and toggles `active: true`.
4. Operator triggers an initial round of test jobs via the webhook.
5. Operator reviews the package QA matrix in FF90-05 before any
   approval / publish action.
