# FF90 Security Report

**Mode:** source/test audit; no Production access or writes.

| Control | Result | Evidence / notes |
|---|---|---|
| Admin session authentication | PASS (source) | `lib/auth/session.ts` uses HS256 HMAC, checks algorithm/type, expiry, role allowlist and timing-safe signature comparison. `lib/admin/guard.ts` rejects missing, short or placeholder `AUTH_SECRET` and enforces roles. |
| Cookie settings | PASS (source) | Session cookie helper sets HttpOnly, SameSite=Lax and Secure in production. Verify effective proxy/TLS deployment when Ubuntu hosting is selected. |
| CSRF | PARTIAL | `lib/security/csrf.ts` checks Fetch Metadata/Origin, but any present `x-automation-secret` header bypasses CSRF. Mutating manual routes still perform admin authorization; automation routes use shared-secret auth. Preserve route ordering and add route-level regression checks when adding endpoints. |
| Automation authentication | PASS (source) | `x-automation-secret`, constant-time comparison, server-only `AUTOMATION_SECRET`; routes also fail closed on missing secret. |
| Kill switch | PASS (source), Production value UNVERIFIED | Exact `AUTOMATION_ENABLED === "true"`; other states return disabled. Do not infer from variable presence. |
| PostgreSQL transport | FIXED IN SOURCE / NOT LIVE VERIFIED | Prior `rejectUnauthorized:false` was removed from app pool and migration runner. Default verified TLS and production rejection of disable mode are unit-tested; no database connection was made. |
| SQL injection | PASS by source scan of reviewed repositories | User-controlled SQL values use parameter placeholders; editorial query builder selects sort fields from allowlisted clauses. This is a targeted source review, not a whole-program formal proof. |
| DB error/secret disclosure | FIXED IN SOURCE / TESTED | Driver message and URL query string are no longer printed by migration runner; app errors/logs use SQLSTATE/generic identifiers and do not retain raw driver causes. |
| WordPress webhook | PARTIAL | Plugin checks `X-Football-Factory-Token` with `hash_equals`; token is configured in a WordPress option, so storage is in the WP database, not environment-only. Coordinate secret migration before production rollout; no token value was read. |
| Webhook payload logging | FIXED IN SOURCE / PHP NOT LINTED | `rest_n8n_event` now logs sanitized payload key names only instead of the full request body when `WP_DEBUG` is enabled. PHP CLI unavailable. |
| WordPress capabilities | PASS (source, partial surface) | Plugin admin settings require custom manage capability; REST event route has token permission callback; public status/matches endpoints are read-only. Inspect any future write endpoints separately. |
| Output escaping/sanitization | PARTIAL | Admin settings use escaping and sanitize callbacks in inspected plugin source; full template/REST parameter review and PHPCS were not run. |
| CSP | NOT ENFORCED | Middleware sets `Content-Security-Policy-Report-Only`, includes `unsafe-inline` and `unsafe-eval`; enforcement awaits report review. Do not claim CSP protection. |
| Security headers | PARTIAL | HSTS, nosniff, referrer, permissions and frame controls are configured. Next build warns that `removePoweredByHeader` is unrecognized, so that option is not evidence of header removal. |
| Secret management | PARTIAL | Next server credentials use environment variables in code; WordPress plugin stores webhook/revalidation settings in WP options. Do not copy secrets into Git or expose any through `NEXT_PUBLIC_*`. |
| Production DB protection | NOT TESTED | No production connection or query was made. Migration runner was not run. |
