// Football Factory — Phase 17C admin resume-pipeline tests.
//
// Coverage:
//   - detail page exposes the new resume section
//   - detail page exposes Run Local SEO Check button
//   - detail page exposes Create WP Draft button
//   - resume component targets the existing editorial item id
//   - NO create-editorial endpoint is called from the resume section
//   - NO publish button exists in the resume section
//   - rights manual_review does not become cleared
//   - fact pending_manual does not become cleared
//   - the resume section calls existing admin endpoints (not
//     automation-secret endpoints)
//   - the resume section does NOT touch protected paths
//   - the existing seo-check + wp-draft route files enforce auth +
//     CSRF + the no-publish contract (re-asserted here so the resume
//     slice inherits those guarantees)

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FRONTEND = join(process.cwd());
const RESUME_COMP = "components/admin/resume-pipeline.tsx";
const DETAIL_PAGE = "app/(admin)/admin/editorial/[id]/page.tsx";
const SEO_ROUTE = "app/api/admin/editorial/[id]/seo-check/route.ts";
const WP_ROUTE = "app/api/admin/editorial/[id]/wp-draft/route.ts";
const DEDUPE_ROUTE = "app/api/admin/editorial/deduplicate/route.ts";

function readSrc(rel: string): string {
  return readFileSync(join(FRONTEND, rel), "utf-8");
}

// ============================================================
// RESUME COMPONENT EXISTS
// ============================================================

test("admin resume: pipeline component file exists", () => {
  const fs = require("node:fs");
  assert.equal(
    fs.existsSync(join(FRONTEND, RESUME_COMP)),
    true,
    "components/admin/resume-pipeline.tsx must exist",
  );
});

// ============================================================
// DETAIL PAGE WIRES THE RESUME COMPONENT
// ============================================================

test("admin resume: detail page imports AdminResumePipeline", () => {
  const src = readSrc(DETAIL_PAGE);
  assert.match(src, /import \{ AdminResumePipeline \}/);
  assert.match(src, /AdminResumePipeline item=\{item\} \/>/);
});

// ============================================================
// EXPOSES BOTH RESUME BUTTONS
// ============================================================

test("admin resume: exposes Run Local SEO Check button", () => {
  const src = readSrc(RESUME_COMP);
  assert.match(src, /Run Local SEO Check/);
  assert.match(src, /data-testid="admin-resume-seo"/);
});

test("admin resume: exposes Create WP Draft button", () => {
  const src = readSrc(RESUME_COMP);
  assert.match(src, /Create WP Draft/);
  assert.match(src, /data-testid="admin-resume-wp-draft"/);
});

// ============================================================
// TARGETS THE EXISTING [id] — NO NEW ITEM CREATED
// ============================================================

test("admin resume: SEO action targets the existing editorial item id", () => {
  const src = readSrc(RESUME_COMP);
  assert.match(
    src,
    /\/api\/admin\/editorial\/\$\{item\.id\}\/seo-check/,
    "resume seo must use item.id from props",
  );
});

test("admin resume: WP-draft action targets the existing editorial item id", () => {
  const src = readSrc(RESUME_COMP);
  assert.match(
    src,
    /\/api\/admin\/editorial\/\$\{item\.id\}\/wp-draft/,
    "resume wp-draft must use item.id from props",
  );
});

test("admin resume: NO create-editorial endpoint is called", () => {
  const src = readSrc(RESUME_COMP);
  assert.doesNotMatch(
    src,
    /\/api\/admin\/editorial\/create\b/,
    "resume must not POST to /api/admin/editorial/create",
  );
  // Also deny the automation-secret variant
  assert.doesNotMatch(
    src,
    /\/api\/automation\/editorial-item\b/,
    "resume must not POST to /api/automation/editorial-item",
  );
});

test("admin resume: reuses dedupe to claim a run id (idempotent on source_id)", () => {
  const src = readSrc(RESUME_COMP);
  assert.match(
    src,
    /\/api\/admin\/editorial\/deduplicate/,
    "resume must call dedupe to claim a run id (idempotent on source_id)",
  );
  assert.match(src, /source_id:\s*item\.source_id/);
});

// ============================================================
// NO PUBLISH BUTTON
// ============================================================

test("admin resume: NO publish button exists", () => {
  const src = readSrc(RESUME_COMP);
  // Strip JS block comments + line comments so we only inspect
  // executable code. We then assert that no code path references
  // publish / schedule / approval mutation.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  // No publish / schedule button labels in JSX.
  assert.doesNotMatch(stripped, />\s*Publish\s*</);
  assert.doesNotMatch(stripped, />\s*Schedule\s*</);
  // No publish endpoint references in code.
  assert.doesNotMatch(stripped, /wp-publish/);
  // No approval-mutation paths in code.
  assert.doesNotMatch(stripped, /\/api\/admin\/editorial\/\$\{item\.id\}\/approval\b/);
  // No rights auto-clear in code.
  assert.doesNotMatch(stripped, /rights_confirmed\s*=\s*true/);
});

// ============================================================
// NO RIGHTS AUTO-CLEAR OR FACT AUTO-CLEAR
// ============================================================

test("admin resume: rights manual_review does not become cleared", () => {
  const src = readSrc(RESUME_COMP);
  // No rights mutation at all in this component.
  assert.doesNotMatch(src, /rights-review/);
  assert.doesNotMatch(src, /rights-check/);
  assert.doesNotMatch(src, /rights_confirmed/);
});

test("admin resume: fact pending_manual does not become cleared", () => {
  const src = readSrc(RESUME_COMP);
  assert.doesNotMatch(src, /fact-review/);
  assert.doesNotMatch(src, /fact-check/);
  assert.doesNotMatch(src, /state.*=.*"cleared"/);
});

// ============================================================
// USES EXISTING ADMIN ENDPOINTS (REUSE, NO DUPLICATION)
// ============================================================

test("admin resume: reuses existing admin endpoints (no automation secret path)", () => {
  const src = readSrc(RESUME_COMP);
  // Must use the admin endpoints, not the automation-secret variants.
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /x-automation-secret/);
  assert.doesNotMatch(src, /AUTOMATION_SECRET/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
  // Admin endpoints should be present.
  assert.match(src, /\/api\/admin\/editorial\/\$\{item\.id\}\/seo-check/);
  assert.match(src, /\/api\/admin\/editorial\/\$\{item\.id\}\/wp-draft/);
});

// ============================================================
// BACKEND GUARANTEES CARRIED INTO RESUME FLOW
// ============================================================

test("admin resume: existing seo-check route still uses runPipelineStep (auth + CSRF)", () => {
  const src = readSrc(SEO_ROUTE);
  assert.match(src, /runPipelineStep/);
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
});

test("admin resume: existing wp-draft route still uses runPipelineStep (auth + CSRF)", () => {
  const src = readSrc(WP_ROUTE);
  assert.match(src, /runPipelineStep/);
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
  // WP draft must NEVER set status=publish
  assert.match(src, /status:\s*"draft"/);
  assert.doesNotMatch(src, /status:\s*"publish"/);
  // Idempotency
  assert.match(src, /decideWpDraft/);
});

test("admin resume: existing dedupe route still uses runPipelineStep (auth + CSRF)", () => {
  const src = readSrc(DEDUPE_ROUTE);
  assert.match(src, /runPipelineStep/);
  assert.doesNotMatch(src, /verifyAutomationSecret/);
  assert.doesNotMatch(src, /assertAutomationEnabled/);
});

// ============================================================
// NO PUBLISH ENDPOINT IN ADMIN SCOPE
// ============================================================

test("admin resume: no wp-publish route exists in admin scope (resume slice keeps this invariant)", () => {
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
    assert.doesNotMatch(
      String(f),
      /wp-publish/,
      "no admin wp-publish route must exist",
    );
  }
});

// ============================================================
// PROTECTED PATHS UNTOUCHED
// ============================================================

test("admin resume: does NOT touch protected paths", () => {
  const protectedPaths = [
    "app/news/[slug]/page.tsx",
    "components/prompt-factory-v2",
    "lib/prompt-factory-v2",
    ".hermes-audit-set2",
    "benchmark-security.json",
    "public/branding/ff90/ff90-icon-source.png",
    "public/branding/ff90/ff90-logo-mark-on-dark.png",
  ];
  // Confirm the new resume component + detail page edits do not
  // reference any of the protected paths in their imports or
  // generated output paths.
  for (const f of [RESUME_COMP, DETAIL_PAGE]) {
    const src = readSrc(f);
    for (const p of protectedPaths) {
      assert.doesNotMatch(
        src,
        new RegExp(p.replace(/[.[\]]/g, "\\$&")),
        `${f} must not reference ${p}`,
      );
    }
  }
});

// ============================================================
// SOURCE INTEGRITY NOTE
// ============================================================

test("admin resume: does NOT mutate the source record", () => {
  const src = readSrc(RESUME_COMP);
  // The resume slice never POSTs to the source-edit endpoint
  // (no such admin endpoint exists, but we still assert this).
  assert.doesNotMatch(src, /source_edit/);
  assert.doesNotMatch(src, /updateSource/);
  // source_id is passed to dedupe but never re-assigned.
  assert.match(src, /source_id:\s*item\.source_id/);
  // No PATCH/PUT on editorial_items source columns.
  assert.doesNotMatch(src, /editorial_items\.source_id\s*=/);
});
