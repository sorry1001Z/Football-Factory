# Football Factory — Pre Go-Live Checklist

**Phase:** `FOOTBALL_FACTORY_FULL_INTEGRATION_AUTOMATION`
**Status flags:** `PRE_GO_LIVE_SECURITY_GATE=PENDING`, `GO_LIVE_ALLOWED=false`

This checklist must be fully PASS before public Go-Live. Each item is enforceable and requires evidence.

---

## 1. Functional Integration

- [ ] Frontend deployed (https://football-factory-three.vercel.app) — all public routes return 200
- [ ] Admin deployed (`/admin`) — guard correctly 401s without session; admin/editor can sign in
- [ ] Football data live (REAL provider credentials configured; `/api/football/competitions` returns non-empty `data`)
- [ ] WordPress live (WPGraphQL endpoint reachable from production; REST write returns 200 for a draft)
- [ ] Banner Composer wired into automation pre-publish hook
- [ ] Image policy enforced (rights + freshness + canonicalization all reachable)
- [ ] SEO metadata complete (title, description, canonical, OG, sitemap, robots)

## 2. Automation E2E

- [ ] One real end-to-end run completes through the full FF_HOOK_1..8 path
- [ ] Run ends in `WAITING_HUMAN_APPROVAL` (no auto-publish)
- [ ] Idempotency verified (same `idempotency_key` ×2 → exactly one INSERT)
- [ ] Failure recovery verified (Football API down → run pending; retry; then success)
- [ ] Audit log persisted end-to-end
- [ ] Automation Admin dashboard operational

## 3. CMS

- [ ] WordPress draft from automation route returns the correct wp_post_id
- [ ] WP REST update with `status='publish'` succeeds only after approval + rights + stage gates
- [ ] WP REST `DELETE` uses `force=false` (trash, not destroy)
- [ ] WPGraphQL read endpoint reachable; first 8 posts rendered

## 4. Football Data

- [ ] Provider configured (FOOTBALL_DATA_API_KEY or API_FOOTBALL_KEY)
- [ ] Provider resolves to one of two allowed names (allowlist enforced)
- [ ] Competitions endpoint returns ≥5 real records
- [ ] Matches endpoint returns matches for the current matchday
- [ ] Standings endpoint returns standings for the active league
- [ ] Quota manager enforces daily limit
- [ ] Cache layer serves recent responses within TTL

## 5. Admin

- [ ] Admin sign-in works with seeded admin user
- [ ] Editorial queue renders all items filtered by stage + approval_state
- [ ] Run detail page exposes timeline + audit events
- [ ] Retry button enforces retry policy (refuses when REFUSED)
- [ ] Cancel button respects terminal states
- [ ] /api/admin/* all return 401 without cookie, 403 for non-admin

## 6. Deployment Verified

- [ ] Vercel Production Environment deployed
- [ ] All required env vars present in Vercel Production
- [ ] Smoke probe 100% green against production
- [ ] SEO smoke 100% green
- [ ] Security smoke (basic headers) 100% green
- [ ] Build green: 818 lib + 62 scripts tests PASS
- [ ] Typecheck silent
- [ ] Build clean (no warnings)

## 7. Backup / Restore

- [ ] Postgres automated daily backups (Neon provides this by default)
- [ ] Last successful backup ≤ 24 hours ago
- [ ] Manual restore procedure documented and tested (in dev environment)

## 8. Monitoring

- [ ] Application logs visible (vercel.com project logs)
- [ ] Database connection errors alertable
- [ ] Football provider quota warnings visible
- [ ] WordPress endpoint reachability monitored
- [ ] Automation run failures visible in admin UI

## 9. PRE_GO_LIVE_SECURITY_GATE (full required before public Go-Live)

- [ ] API rate limiting — distributed (Redis / KV), per-user, per-IP, per-route
- [ ] Login / admin brute-force protection — exponential backoff + lockout
- [ ] WAF-ready deployment — review Cloudflare / Vercel WAF config
- [ ] Bot / abuse protection — CAPTCHA where appropriate
- [ ] Request / body / upload limits enforced on every mutation route
- [ ] Session / JWT / role verification audit — every admin route confirmed
- [ ] Admin route hardening — CSRF + same-origin + role
- [ ] Security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [ ] Logging / anomaly alerting
- [ ] Cache / CDN protection
- [ ] 429 handling (responses include Retry-After + JSON envelope)
- [ ] Load / abuse testing
- [ ] Secrets / config audit — no secrets in repo, no placeholders in Vercel env
- [ ] Final security smoke / regression

## 10. Performance Gate

- [ ] p95 home < 1.5s
- [ ] p95 article < 1.0s
- [ ] p95 standings < 1.5s
- [ ] p95 critical API < 500ms (cached) / < 1500ms (uncached)
- [ ] No obvious regressions vs 9/12 baseline

## 11. Human Approval

- [ ] Editorial workflow validated by human review of at least one real article
- [ ] Publish path requires explicit human approval (cannot be auto-bypassed)
- [ ] Right-of-rejection respected for rights review

## 12. GO LIVE

- [ ] All sections above checked
- [ ] Final report delivered to director
- [ ] Director sets `GO_LIVE_ALLOWED=true`
- [ ] Production traffic enabled
