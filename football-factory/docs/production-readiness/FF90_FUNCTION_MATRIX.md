# FF90 Function Matrix

**Evidence boundary:** source and local tests only; no live site verification.

| Function | Status | Source evidence / limitation |
|---|---|---|
| Homepage | PARTIAL | Next route group `(shell)/page.tsx` and theme `front-page.php` exist. WordPress client falls back to mock news if GraphQL is absent or errors, so a rendered page alone does not prove live CMS content. |
| News index | PARTIAL | `(shell)/news/page.tsx` exists; live content depends on WPGraphQL configuration and its query contract. |
| News article and metadata | PARTIAL | `app/news/[slug]/page.tsx` exists; metadata and Article/NewsArticle behavior are source-backed, but actual rendered Production HTML and SEO-plugin interoperability were not checked. |
| Categories/competitions | PARTIAL | `app/(shell)/competitions/[slug]/page.tsx` and league routes/templates exist. Runtime data and empty/error states were not browser-tested. |
| Match pages | PARTIAL | `app/match/[slug]/page.tsx`, football APIs and match components exist. Live provider keys and external provider uptime were not tested. |
| Today/date selector | PARTIAL | Match/date components and `/api/football/matches` exist. Time zone boundaries and date-specific production responses are NOT TESTED. |
| Standings | PARTIAL | `/api/football/standings` and theme standings template exist; no live provider acceptance evidence. |
| Team/national-team pages | PARTIAL | Team pages and components exist. No Production data/render verification. |
| Responsive UI/navigation | UNVERIFIED | Responsive theme styles/components and navigation templates exist; no browser/device visual regression suite was found or run. |
| Loading/error/empty states | PARTIAL | Source includes skeleton/error templates and API envelopes. Production upstream failure behavior was not exercised. |
| WordPress headless read path | PARTIAL | WPGraphQL client uses timeout and mock fallback. Fallback hides outages from public page status; health endpoint probe is required to prove live connectivity. |
| WordPress Draft writes | IMPLEMENTED / NOT PRODUCTION VERIFIED | Admin and automation write routes plus `WordPressWriteClient` exist; route tests cover Draft-only defaults and rejection of publish. No production write was made. |
| SEO fields | PARTIAL | Frontend and plugin schema sources exist, but this audit did not verify deployed HTML, canonical/OG values, plugin conflicts, or image metadata on actual pages. |
| n8n integration | PARTIAL | Seven workflow JSON files exist (MASTER, five child workflows, harness); all runtime IDs/credential bindings and runtime activation state require external verification. No workflow executed. |
| Run states/recovery | PARTIAL | Phase 19 state/recovery policies, DB routes and tests exist; actual Production DB state and migration 006/007 acceptance are unverified. |
| Kill switch | IMPLEMENTED (source) | `AUTOMATION_ENABLED` must equal exact string `true`; otherwise automation routes fail closed. Effective Production value was not read. |
| Duplicate Draft protection | PARTIAL | Source has idempotent run/editorial draft-operation paths and tests; cross-service WordPress timeout/reconciliation behavior was not tested against Production. |
| Manual editorial approval | IMPLEMENTED (source) | Admin approval/rights/fact gates and tests exist. Human workflow usability and deployed role mapping are NOT TESTED. |
| Automatic publishing | PRESENT BUT GUARDED | A `wp-publish` API route exists, guarded by automation secret, kill switch, approval and status checks. No publish call was executed. This surface requires deployment-specific authorization review. |
| Ubuntu deployment | MISSING | No tracked Docker, systemd, nginx, or Ubuntu deployment artifact. Current repo guide names Vercel as frontend host. |
| Health check | PARTIAL | `/api/health` reports frontend/config booleans and always 200; WordPress probe is separate. New script checks frontend, WordPress reachability, sitemap, robots and a supplied article path. Live result is NOT TESTED. |
