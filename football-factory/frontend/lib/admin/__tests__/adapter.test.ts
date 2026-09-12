// Football Factory — Admin adapter tests (R2 Wave 2C).
//
// Covers:
//   - normalizeAuditRow: redacts known secret keys, caps metadata size.
//   - normalizeAuditRow: produces human-readable summary strings.
//   - normalizeRunRow: surfaces only safe columns.
//   - toEditorialView: derives rights/fact state from metadata.
//   - buildSearchFragment: returns null for empty input.
//   - buildSearchFragment: escapes LIKE wildcards.
//   - buildSearchFragment: shifts placeholders correctly.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAuditRow,
  normalizeRunRow,
  toEditorialView,
  buildSearchFragment,
} from "../adapter";

test("normalizeAuditRow: redacts token key from metadata", () => {
  const out = normalizeAuditRow({
    id: 1,
    created_at: "2026-09-12T00:00:00Z",
    action: "rights_review",
    actor_user_id: null,
    metadata: { decision: "cleared", token: "leak", password: "leak", reason: "ok" },
  });
  assert.equal(out.action, "rights_review");
  // `redactSecrets()` (lib/auth/redact-secrets.ts) replaces
  // forbidden keys with the literal "[REDACTED]". The adapter
  // surfaces that string instead of leaking the original value.
  assert.equal(out.metadataSafe.token, "[REDACTED]");
  assert.equal(out.metadataSafe.password, "[REDACTED]");
  assert.equal(out.metadataSafe.decision, "cleared");
  assert.equal(out.metadataSafe.reason, "ok");
});

test("normalizeAuditRow: caps oversized string values", () => {
  const big = "x".repeat(5000);
  const out = normalizeAuditRow({
    id: 1,
    created_at: "2026-09-12T00:00:00Z",
    action: "wp_publish",
    actor_user_id: null,
    metadata: { reason: big },
  });
  assert.ok(typeof out.metadataSafe.reason === "string");
  assert.ok((out.metadataSafe.reason as string).endsWith("…"));
  assert.ok((out.metadataSafe.reason as string).length <= 2050);
});

test("normalizeAuditRow: caps metadata object to 16 keys", () => {
  const meta: Record<string, unknown> = {};
  for (let i = 0; i < 40; i++) meta[`k${i}`] = i;
  const out = normalizeAuditRow({
    id: 1,
    created_at: "2026-09-12T00:00:00Z",
    action: "wp_draft",
    actor_user_id: null,
    metadata: meta,
  });
  assert.ok(Object.keys(out.metadataSafe).length <= 16);
});

test("normalizeAuditRow: builds readable summaries", () => {
  const r1 = normalizeAuditRow({
    id: 1,
    created_at: "2026-09-12T00:00:00Z",
    action: "rights_review",
    actor_user_id: "u1",
    metadata: { decision: "cleared", method: "human_review" },
  });
  assert.equal(r1.summary, "Rights review: cleared (human_review)");
  assert.equal(r1.actor, "u1");

  const r2 = normalizeAuditRow({
    id: 2,
    created_at: "2026-09-12T00:00:00Z",
    action: "fact_review",
    actor_user_id: null,
    metadata: { decision: "rejected" },
  });
  assert.equal(r2.summary, "Fact review: rejected");

  const r3 = normalizeAuditRow({
    id: 3,
    created_at: "2026-09-12T00:00:00Z",
    action: "approval_decision",
    actor_user_id: null,
    metadata: { new_state: "approved" },
  });
  assert.equal(r3.summary, "Approval: approved");

  const r4 = normalizeAuditRow({
    id: 4,
    created_at: "2026-09-12T00:00:00Z",
    action: "stage_advance",
    actor_user_id: null,
    metadata: { from: "draft_created", to: "waiting_approval" },
  });
  assert.equal(r4.summary, "Stage: draft_created → waiting_approval");

  const r5 = normalizeAuditRow({
    id: 5,
    created_at: "2026-09-12T00:00:00Z",
    action: "wp_publish",
    actor_user_id: null,
    metadata: {},
  });
  assert.equal(r5.summary, "Automation: wp_publish");

  const r6 = normalizeAuditRow({
    id: 6,
    created_at: "2026-09-12T00:00:00Z",
    action: "retry_request",
    actor_user_id: null,
    metadata: { reason: "timeout in upstream" },
  });
  assert.equal(r6.summary, "Retry requested: timeout in upstream");
});

test("normalizeAuditRow: never throws on null/undefined metadata", () => {
  const out = normalizeAuditRow({
    id: 1,
    created_at: "2026-09-12T00:00:00Z",
    action: "dedupe",
    actor_user_id: null,
    metadata: null,
  });
  assert.ok(out.metadataSafe);
  assert.equal(typeof out.metadataSafe, "object");
});

test("normalizeRunRow: maps raw row to summary", () => {
  const out = normalizeRunRow({
    id: "r1",
    workflow: "ff-staging",
    status: "failed",
    stage: "fact_check",
    error_class: "timeout",
    editorial_item_id: "e1",
    wp_post_id: 100,
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-12T00:01:00Z",
  });
  assert.equal(out.id, "r1");
  assert.equal(out.workflow, "ff-staging");
  assert.equal(out.status, "failed");
  assert.equal(out.errorClass, "timeout");
  assert.equal(out.wpPostId, 100);
  assert.equal(out.editorialItemId, "e1");
});

test("normalizeRunRow: handles missing columns with safe defaults", () => {
  const out = normalizeRunRow({
    id: "r1",
    workflow: "ff",
    status: "running",
    stage: null,
    error_class: null,
    editorial_item_id: null,
    wp_post_id: null,
    created_at: "",
    updated_at: "",
  });
  assert.equal(out.stage, "—");
  assert.equal(out.errorClass, "unknown");
  assert.equal(out.editorialItemId, null);
  assert.equal(out.wpPostId, null);
});

test("toEditorialView: derives rights/fact state from metadata", () => {
  const view = toEditorialView({
    id: "e1",
    source_id: "src-1",
    wp_post_id: null,
    stage: "fact_check",
    approval_state: "pending",
    rights_confirmed: false,
    approved_by: null,
    approved_at: null,
    metadata: {
      title: "Test title",
      source_url: "https://example.com",
      source_name: "Example",
      rights: { state: "manual_review" },
      fact: { state: "cleared" },
    },
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-12T00:01:00Z",
  });
  assert.equal(view.title, "Test title");
  assert.equal(view.rightsState, "manual_review");
  assert.equal(view.factState, "cleared");
});

test("toEditorialView: missing rights/fact returns 'missing'", () => {
  const view = toEditorialView({
    id: "e2",
    source_id: "src-2",
    wp_post_id: null,
    stage: "ingested",
    approval_state: "pending",
    rights_confirmed: false,
    approved_by: null,
    approved_at: null,
    metadata: {},
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-12T00:01:00Z",
  });
  assert.equal(view.rightsState, "missing");
  assert.equal(view.factState, "missing");
});

test("toEditorialView: falls back to source_id when no title", () => {
  const view = toEditorialView({
    id: "e3",
    source_id: "src-fallback",
    wp_post_id: null,
    stage: "ingested",
    approval_state: "pending",
    rights_confirmed: false,
    approved_by: null,
    approved_at: null,
    metadata: {},
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-12T00:01:00Z",
  });
  assert.equal(view.title, "src-fallback");
});

test("buildSearchFragment: returns null for empty input", () => {
  assert.equal(buildSearchFragment(""), null);
  assert.equal(buildSearchFragment("   "), null);
});

test("buildSearchFragment: escapes LIKE wildcards", () => {
  const frag = buildSearchFragment("50%_off");
  assert.ok(frag);
  // The bound value should escape % and _ so the substring search
  // does not match unrelated rows.
  assert.ok(frag!.params[0]);
  assert.ok(frag!.params[0].includes("\\%"));
  assert.ok(frag!.params[0].includes("\\_"));
});

test("buildSearchFragment: returns clause with placeholder", () => {
  const frag = buildSearchFragment("hello");
  assert.ok(frag);
  assert.ok(frag!.clause.includes("$1"));
  assert.ok(frag!.params[0].startsWith("%"));
  assert.ok(frag!.params[0].endsWith("%"));
});

test("buildSearchFragment: keeps user input bound as parameter, never inline", () => {
  // Defence-in-depth: confirm the raw user input never appears
  // un-escaped in the clause fragment.
  const frag = buildSearchFragment("evil'; DROP TABLE x; --");
  assert.ok(frag);
  assert.ok(frag!.clause.includes("$1"));
  assert.ok(!frag!.clause.includes("evil"));
  assert.ok(!frag!.clause.includes("DROP"));
  assert.ok(frag!.params[0].includes("evil"));
});
