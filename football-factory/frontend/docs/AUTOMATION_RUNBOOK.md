# Football Factory — Automation Runbook

**Phase:** `FOOTBALL_FACTORY_FULL_INTEGRATION_AUTOMATION`

Operational runbook for the automation framework. Use this when responding to alerts or investigating failed automation runs.

---

## Quick reference

| Symptom | First check | If failing, also check |
|---|---|---|
| Football data empty | `/api/football/health` | `FOOTBALL_DATA_API_KEY` in Vercel |
| WPGraphQL stale / 500 | `/api/health/wordpress?probe=1` | Cloudflare tunnel alive? DNS rotation? |
| Run stuck `running` | `automation_runs` query for started_at older than 30m | Worker process alive? rate-limit hit? |
| Publish refused 409 | Body returned error code | See §2 below |
| 401 automation_secret_invalid | n8n workflow header value | Compare to `AUTOMATION_SECRET` in Vercel |
| 503 database_not_configured | `DATABASE_URL` env in Vercel | Migrations applied? |
| 503 auth_secret_not_configured | `AUTH_SECRET` env in Vercel | At least 32 chars, not a placeholder |

---

## 1. Health checks (start here)

```bash
BASE_URL=https://football-factory-three.vercel.app

# All-in-one
curl -s $BASE_URL/api/health | head
curl -s $BASE_URL/api/football/health | head
curl -s $BASE_URL/api/health/wordpress?probe=1 | head

# Admin guard
curl -i -X GET  $BASE_URL/api/admin/posts         # expect 401
curl -i -X POST $BASE_URL/api/automation/deduplicate \
     -H 'content-type: application/json' \
     -d '{"idempotency_key":"hk-probe-001","workflow":"probe"}'    # expect 401
```

Expected:
- `/api/health` → 200, `ok:true`
- `/api/football/health` → 200, `provider: <name>`, `configured: true|false`
- `/api/health/wordpress?probe=1` → 200 with `configured`, `reachable`, optional `reason`
- `/api/admin/posts` (no cookie) → 401 `unauthenticated`
- `/api/automation/deduplicate` (no secret) → 401 `automation_secret_invalid`

If any are wrong, see §2.

---

## 2. Common failure modes & diagnosis

### 2.1 `401 automation_secret_invalid`

**Cause**: caller is not sending `x-automation-secret` OR the value does not match `AUTOMATION_SECRET` env.

**Fix**:
1. Confirm the caller (n8n workflow, custom orchestrator) sets the header.
2. Confirm the value matches Vercel env (never paste the value — verify length only).
3. Confirm the value is at least 16 chars and not a placeholder (`CHANGE_ME` etc.).

### 2.2 `503 database_not_configured`

**Cause**: `DATABASE_URL` not set in Vercel, or the route can't read it.

**Fix**:
1. Verify `DATABASE_URL` is set in Production Vercel.
2. Verify it parses as `postgresql://...`.
3. Verify SSL mode accepted by the DB.
4. After fix, re-deploy.

### 2.3 `wp-publish` returns 409

The error code tells you which gate failed:

| Code | Cause | Fix |
|---|---|---|
| `editorial_link_missing` | `run.editorial_item_id` is NULL | Create editorial item via `/api/automation/editorial-item` first |
| `wp_post_mismatch` | editorial's wp_post_id differs from body's | Confirm wp-draft ran first; pass the correct wp_post_id |
| `approval_not_granted` | `editorial_items.approval_state != 'approved'` | Admin UI: approve the item, then retry |
| `rights_not_cleared` | `rights_confirmed != true` | Run /api/automation/rights-check with a real provider configured; admin override only if `provider_status=configured` |
| `stage_not_approved` | `stage != 'approved'` | Advance stage via the canonical pipeline |

### 2.4 Football data: `data: []`

**Cause**: provider not configured (`configured: false`), or provider reachable but cache miss + quota exceeded, or upstream returned empty.

**Fix**:
1. Check `/api/football/health` → `configured: true|false`.
2. Check `quota.status` — `requests_in_window / daily_limit` near limit means throttle.
3. If provider reachable but empty, retry after a backoff window.

### 2.5 WPGraphQL `reachable: false reason: TIMEOUT`

**Cause**: Cloudflare Quick Tunnel stopped, DNS rotated, or the local WP host is down.

**Fix**:
1. Verify the local WordPress host is reachable from the production region.
2. Restart the cloudflared process if needed.
3. Confirm `wp option home / siteurl` matches the active tunnel URL.

---

## 3. Manual retry procedure

When an automation run is stuck and retry is justified:

1. **Confirm** the run is in a retryable state:
   - `status ∈ {running, failed}`
   - `stage ∉ {rejected, failed, published}`
   - `error_class ∈ {timeout, network, upstream_temporary, wp_retryable}`

2. **POST** to (admin-only route — under construction):

   ```
   POST /api/admin/automation/{runId}/retry
   ```

   The route should call `evaluateRetry()` before mutating.

3. If retry policy says `REFUSED_*`, do NOT retry. Open the editorial item in admin and fix the underlying issue (approval, rights clearance, wp_post_id).

---

## 4. Manual approval procedure

1. Sign in at `/login` (admin role required).
2. Browse `/admin/editorial`.
3. For an item in `approval_state=pending`, click Review.
4. Inspect: title, content, banner preview, SEO preview, source provenance.
5. Set `approval_state='approved'` only when the item passes editorial review.
6. Publish from admin UI (or via automation wp-publish if drafts already linked).

---

## 5. Migration / DB restore

See `docs/MIGRATION_DOWN_PLAN.md` for destructive DOWN steps. Production-grade backup is currently manual (Neon snapshots). Before any change that touches schema:

1. Snapshot the DB.
2. Apply migration.
3. Verify by reading `pg_constraint` for the new constraint.

---

## 6. Alert / log endpoints

- `POST /api/automation/log` — write audit event.
- `POST /api/automation/alert` — write severity event to `analytics_events`.
- Admin reads: `components/admin/{timeline,run}.tsx`.

---

## 7. SECURITY posture reminders

Even when operating under fire:

- **Never** paste a secret in chat. Length-only verification OK.
- **Never** bypass `x-automation-secret` for admin mutations — they use session+role.
- **Never** rotate a secret without rotating its companion (`WORDPRESS_APP_PASSWORD` ↔ `AUTOMATION_SECRET`).
- **Never** skip the rights gate. If rights unclear, set `state='manual_review'` and wait.
- **Never** publish through a route that didn't pass `/api/automation/wp-publish`'s 6 hard gates.

---

## 8. Performance quick check (pre-go-live phase)

Run `npm run smoke` against production. Reported timing per route. Any route that grows > 2× baseline is a regression candidate. Full load testing belongs to `PRE_GO_LIVE_SECURITY_GATE`.
