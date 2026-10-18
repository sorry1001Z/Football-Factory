# Modular foundation QA — 18 October 2026

Scope: nine new independently installable 0.1.0 WordPress plugins; previous SEO,
News Insights, Core, theme, Next.js and Hermes source remain unchanged. New
plugins are working baseline modules, not a declaration that externally named
Security V4/SEO V4 or the complete production A–L system is finished.

Runtime: real WordPress 6.9, PHP 8.4.24, SQLite, Chromium 154; loopback only.
Installed and activated actual unpacked ZIP distributions, not PHP test doubles
standing in for plugins. Only external football HTTP is doubled explicitly.

| Check | Evidence / outcome |
|---|---|
| PHP lint | PASS all new runtime/test PHP |
| JavaScript parse | PASS QA Gutenberg sidebar and browser runner |
| Module contracts | **84 PASS**, `qa/contracts.txt` |
| Real browser | **13 PASS**, `qa/browser-results.json` |
| Viewports | 360 / 390 / 768 / 1024 / 1440, synthetic fixture page |
| Accessibility | 0 axe WCAG2A/AA + 2.1AA violations in tested frontend fixture |
| Unrelated theme | PASS Twenty Twenty-Five: widgets/banner present, no page overflow |
| Images | Full content ratio within 1 pixel after subtracting theme borders; contain; all 13 kinds; original theme fallback retained |
| Installed distribution | Exact runtime/source/ZIP byte equality; independent folders/licenses/readmes |
| Full production / external staging | **NOT_RUN** |

Coverage includes actual Gutenberg edit-context source metadata save; private
sources omitted from public native REST; actual nonce-protected QA and approval
forms; native REST publish only the exact reviewed version; unreviewed changes
409; source changes preflighted in REST/Classic before publish hooks; native
scheduled publisher wrapped before it can emit a publish event for stale review;
self/stale review rejection, pause, human image-rights attestation and expiry.

Image selection checks exact hashes across attachment IDs, perceptual rejection
of a resized generated image, recent use and exact-hash concurrent leases.
Similarity remains heuristic and cannot guarantee arbitrary edits/crops/rotations.
QA attests what a human declares; it does not independently establish facts or
copyright permissions. Historic use is not silently backfilled on activation.

Football tests exercise normalized Google-free football-data.org-shaped fixtures,
site timezone, real NULL scores, fresh cache, visible stale history, malformed
payload/no-history errors, backoff and atomic quota before upstream requests.
No real API key was used and no football-data provider call was made.

Automation checks persisted jobs, identical-key replay, conflicting payload,
review boundary, missing handoff blocked, bounded transient retry, expired lease
recovery and conditional commit preventing an old worker overwriting a new one.
Built-in handlers do not publish. Real n8n/Hermes/cron has not run here.

Content export uses actual native WXR to a private directory outside webroot,
0600 files/0700 directory, SHA-256 verification, XML parsing and deliberate
corruption rejection. This is **content export only**, not full DB/media/config
backup. **No restore test or restore engine is claimed.**

## Issues resolved during integration

- Original banner helper names collided with the theme. Renamed helpers to the
  renderer-specific prefix and verified activation plus unrelated-theme output.
- Renderer registered-meta default initially would hide existing category fallback.
  Changed unset value to empty; added regression contracts for the actual theme.
- Gutenberg sources moved to native REST-backed sidebar (Classic box excluded in
  block editor), so final source values are preflighted before publish callbacks.
- Mobile standings needed minimum table width with internal accessible scrolling.
- Banner assertion initially compared border-box ratio and failed on theme borders/
  responsive srcset rounding. Verified image content-box and all pixels instead.
- Native export header warnings in CLI were caused by printing checks before export;
  runner now buffers output to use the same no-prior-output contract as admin-post.

All final counts refer to completed successful runs, not the failed initial
attempts. Cleanup removes synthetic news/users/media/jobs/private export files/
provider MU helper and restores prior settings/theme/cache/quota. Audit records
of actual browser test actions may remain only in local sandbox, never in ZIP.

Remaining: exact external V4 security requirements, live provider/Google/n8n,
real source/image feed, external fact checking (current QA is human), full-cache
analytics, private host backup adapter plus actual restore drill, MySQL/MariaDB,
external staging/production/CDN, Firefox/Safari and manual screen-reader review.
GitHub PR creation remains unavailable through the previously forbidden API;
source branch push and local review artifacts are separate and supported.


## อัปเดต API-Football — 18 ตุลาคม 2026

Football Data Engine 0.2.0 และ Widgets 0.1.1 เพิ่ม API-Football บน local แล้ว ยืนยัน Free active 100/day, fixtures วันนี้ 5 ลีก และพบว่า standings PL ปี 2026 ถูกปฏิเสธ (2024 ใช้ได้) สถานะเก่า NOT_RUN ของ API-Football ในเอกสารนี้ถูกแทนเฉพาะส่วนที่ตรวจจริงข้างต้น ดู [แผน Free และผลเชื่อมจริง](API_FOOTBALL_FREE_PLAN_TH.md) ส่วน Google/Hermes/Production และฟีเจอร์อื่นยังคงสถานะเดิม
