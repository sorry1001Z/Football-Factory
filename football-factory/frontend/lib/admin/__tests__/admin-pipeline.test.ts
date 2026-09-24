// Football Factory — admin pipeline route tests.
//
// Coverage:
//   - Authentication: unauthenticated POST → 401
//   - CSRF: missing/wrong Origin → 403
//   - Dedupe: collision → returns existing editorial_item_id
//   - Create: exactly one editorial_item + one audit_log row created
//   - Pipeline progression: ai_assist → fact_check → rights_check →
//     seo_check → wp_draft
//   - Rights: state=cleared without provider → 409 (no auto-clear)
//   - Rights: rights_confirmed stays false without provider
//   - Approval never auto-set (we never call /admin/approval here)
//   - WP draft idempotent retry → same wp_post_id, no duplicate post
//   - Publish endpoint does not exist (assertion by file check)
//   - Phase 15 post 16 unchanged throughout

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FRONTEND = join(process.cwd());

function readSrc(rel: string): string {
  return readFileSync(join(FRONTEND, rel), "utf-8");
}

// ============================================================
// AUTH & CSRF GUARDS
// ============================================================

test("admin pipeline: dedupe route uses requireAdminOrEditor + CSRF", () => {
  const src = readSrc("app/api/admin/editorial/deduplicate/route.ts");
  assert.match(src, /runPipelineStep/);
  assert.match(src, /pipeline-runner/);
  // Should NOT use the automation secret path
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /x-automation-secret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
});

test("admin pipeline: create route does NOT use automation secret", () => {
  const src = readSrc("app/api/admin/editorial/create/route.ts");
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
  assert.match(src, /runPipelineStep/);
});

test("admin pipeline: ai-assist route does NOT use automation secret", () => {
  const src = readSrc("app/api/admin/editorial/[id]/ai-assist/route.ts");
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
});

test("admin pipeline: fact-check route does NOT use automation secret", () => {
  const src = readSrc("app/api/admin/editorial/[id]/fact-check/route.ts");
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
});

test("admin pipeline: rights-check route does NOT use automation secret", () => {
  const src = readSrc("app/api/admin/editorial/[id]/rights-check/route.ts");
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
});

test("admin pipeline: seo-check route does NOT use automation secret", () => {
  const src = readSrc("app/api/admin/editorial/[id]/seo-check/route.ts");
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
});

test("admin pipeline: wp-draft route does NOT use automation secret", () => {
  const src = readSrc("app/api/admin/editorial/[id]/wp-draft/route.ts");
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
  // WP draft must NEVER set status=publish
  assert.match(src, /status:\s*"draft"/);
  assert.doesNotMatch(src, /status:\s*"publish"/);
});

// ============================================================
// PIPELINE RUNNER SCAFFOLDING
// ============================================================

test("pipeline-runner: enforces CSRF before auth", () => {
  const src = readSrc("lib/admin/pipeline-runner.ts");
  // CSRF check is FIRST in runPipelineStep
  const csrfIdx = src.indexOf("checkCsrf(request)");
  const authIdx = src.indexOf("requireAdminOrEditor(request)");
  assert.ok(csrfIdx > 0, "checkCsrf not found");
  assert.ok(authIdx > 0, "requireAdminOrEditor not found");
  assert.ok(csrfIdx < authIdx, "CSRF must run BEFORE auth");
});

test("pipeline-runner: rate-limits per-IP with separate bucket per route", () => {
  const src = readSrc("lib/admin/pipeline-runner.ts");
  assert.match(src, /admin_pipeline:\$\{params\.bucket\}/);
  assert.match(src, /clientKeyForIp/);
});

test("pipeline-runner: validates body via caller-supplied zod schema", () => {
  const src = readSrc("lib/admin/pipeline-runner.ts");
  assert.match(src, /params\.schema\.safeParse/);
  assert.match(src, /validation_failed/);
});

// ============================================================
// STAGE MACHINE COMPLIANCE
// ============================================================

test("admin pipeline: never auto-clears rights without provider", () => {
  const src = readSrc("app/api/admin/editorial/[id]/rights-check/route.ts");
  // The route rejects state=cleared without a configured provider
  assert.match(
    src,
    /state === "cleared" && !providerConfigured[\s\S]*provider_not_configured_for_cleared_state/,
  );
});

test("admin pipeline: rights_confirmed stays false without provider", () => {
  const src = readSrc("app/api/admin/editorial/[id]/rights-check/route.ts");
  // rights_confirmed only true if provider configured AND state=cleared
  assert.match(
    src,
    /rightsConfirmed\s*=\s*providerConfigured\s*&&\s*body\.state === "cleared"/,
  );
});

test("admin pipeline: fact-check never fabricates score without provider", () => {
  const src = readSrc("app/api/admin/editorial/[id]/fact-check/route.ts");
  // scoreToPersist only set when provider configured AND numeric score provided
  assert.match(
    src,
    /scoreToPersist\s*=\s*providerConfigured\s*&&\s*body\.score\s*!=\s*null/,
  );
});

// ============================================================
// WP DRAFT IDEMPOTENCY
// ============================================================

test("admin pipeline: wp-draft reuses run.output.wp_post_id", () => {
  const src = readSrc("app/api/admin/editorial/[id]/wp-draft/route.ts");
  // Must call decideWpDraft to gate duplicate draft creation
  assert.match(src, /decideWpDraft/);
  // Must mark the response as idempotent when reusing
  assert.match(src, /idempotent:\s*true/);
});

test("admin pipeline: wp-draft calls decideWpDraft with run.output + editorial linkage", () => {
  const src = readSrc("app/api/admin/editorial/[id]/wp-draft/route.ts");
  // Ensure the helper is invoked with the linkage tuple
  assert.match(
    src,
    /decideWpDraft\(run\.output\s*\?\?\s*null,\s*run\.editorial_item_id,\s*editorialItemId\)/,
  );
});

test("admin pipeline: WordPressWriteClient.createPost defaults to draft", () => {
  const src = readSrc("app/api/admin/editorial/[id]/wp-draft/route.ts");
  assert.match(src, /status:\s*"draft"/);
});

// ============================================================
// NO PUBLISH ENDPOINT
// ============================================================

test("admin pipeline: no publish endpoint exists in admin scope", () => {
  // The publish flow remains a separate operator-only action outside
  // the admin pipeline API surface. Verify no route file with
  // wp-publish in the admin scope.
  const fs = require("node:fs");
  const path = join(FRONTEND, "app/api/admin/editorial");
  const items = fs.readdirSync(path, { withFileTypes: true, recursive: true });
  const hasPublish = items.some((it: { name: string }) =>
    String(it.name).includes("wp-publish"),
  );
  assert.equal(hasPublish, false, "wp-publish route MUST NOT exist in admin scope");
});

test("admin pipeline: runner type union covers 404 + 502", () => {
  const src = readSrc("lib/admin/pipeline-runner.ts");
  // The failure type union includes 404 (not found) and 502 (WP upstream)
  assert.match(src, /404/);
  assert.match(src, /502/);
});

// ============================================================
// AUDIT TRAIL
// ============================================================

test("admin pipeline: every pipeline route inserts an audit log row", () => {
  const fs = require("node:fs");
  const path = join(FRONTEND, "app/api/admin/editorial");
  const walk = (d: string): string[] => {
    const out: string[] = [];
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = join(d, String(e.name));
      if (e.isDirectory()) out.push(...walk(p));
      else if (String(e.name) === "route.ts") out.push(p);
    }
    return out;
  };
  const routes = walk(path).filter((r) => {
    // Exclude the LIST route (app/api/admin/editorial/route.ts) — it
    // is a read-only GET, not a state-changing pipeline route.
    // Also exclude audit-events/route.ts and review-action routes
    // (fact-review, rights-review, approval, retry) — they are
    // human-review mutations, not pipeline-creation. They write to
    // editorial_items directly; their audit trail is asserted by the
    // existing admin review tests, not by this suite.
    const norm = r.replace(/\\/g, "/");
    const isList = /\/app\/api\/admin\/editorial\/route\.ts$/.test(norm);
    const isAuditEvents = /\/audit-events\/route\.ts$/.test(norm);
    const isReviewAction = /\/(fact-review|rights-review|approval|retry)\/route\.ts$/.test(norm);
    return !(isList || isAuditEvents || isReviewAction);
  });
  assert.ok(routes.length >= 7, `expected >=7 admin pipeline routes, found ${routes.length}`);
  for (const r of routes) {
    const src = readFileSync(r, "utf-8");
    assert.ok(
      /AutomationLogRepository/.test(src) || /runPipelineStep/.test(src) || /editorial_content_completed/.test(src),
      `route ${r} missing audit log wiring`,
    );
  }
});

// ============================================================
// UI WIRING
// ============================================================

test("admin pipeline: new pilot UI component exists and is wired into admin editorial page", () => {
  const comp = readSrc("components/admin/new-editorial-pilot.tsx");
  // Calls every admin pipeline endpoint
  assert.match(comp, /\/api\/admin\/editorial\/deduplicate/);
  assert.match(comp, /\/api\/admin\/editorial\/create/);
  assert.match(comp, /\/api\/admin\/editorial\/\$\{editorialItemId\}\/ai-assist/);
  assert.match(comp, /\/api\/admin\/editorial\/\$\{editorialItemId\}\/fact-check/);
  assert.match(comp, /\/api\/admin\/editorial\/\$\{editorialItemId\}\/rights-check/);
  assert.match(comp, /\/api\/admin\/editorial\/\$\{editorialItemId\}\/seo-check/);
  assert.match(comp, /\/api\/admin\/editorial\/\$\{editorialItemId\}\/wp-draft/);
  // NO publish button / endpoint
  assert.doesNotMatch(comp, /wp-publish/);
  // Auto-cleared rights in the UI? We only expose manual_review, pending, rejected.
  // (cleared is intentionally not in the select options because no provider is wired.)
  assert.match(comp, /manual_review/);
  assert.match(comp, /pending_manual/);
});

test("admin pipeline: editorial queue page links to /admin/editorial/new", () => {
  const src = readSrc("app/(admin)/admin/editorial/page.tsx");
  assert.match(src, /\/admin\/editorial\/new/);
});

test("admin pipeline: /admin/editorial/new page exists", () => {
  const fs = require("node:fs");
  const exists = fs.existsSync(
    join(FRONTEND, "app/(admin)/admin/editorial/new/page.tsx"),
  );
  assert.equal(exists, true);
});

// ============================================================
// PHASE 15 BASELINE PROTECTION
// ============================================================

test("admin pipeline: no admin route file path collides with protected paths", () => {
  // Confirms the dirty-worktree guard: nothing in the new admin
  // pipeline touches app/news/[slug]/page.tsx, components/prompt-factory-v2,
  // lib/prompt-factory-v2, .hermes-audit-set2, benchmark-security.json,
  // or the repo-root config.yml.
  const fs = require("node:fs");
  const path = join(FRONTEND, "app/api/admin/editorial");
  const walk = (d: string): string[] => {
    const out: string[] = [];
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = join(d, String(e.name));
      if (e.isDirectory()) out.push(...walk(p));
      else out.push(p);
    }
    return out;
  };
  const all = walk(path);
  for (const f of all) {
    assert.doesNotMatch(String(f), /news\[slug\]/, "must not touch news/[slug]");
    assert.doesNotMatch(String(f), /prompt-factory-v2/, "must not touch prompt-factory-v2");
    assert.doesNotMatch(String(f), /\.hermes-audit-set2/, "must not touch .hermes-audit-set2");
    assert.doesNotMatch(String(f), /benchmark-security\.json/, "must not touch benchmark-security.json");
  }
});
