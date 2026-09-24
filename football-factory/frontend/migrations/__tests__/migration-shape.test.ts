// Structural test for the SQL migrations (FIRST SLICE).
//
// Verifies the SQL files include the expected tables and indexes and
// follow the production migration conventions:
//   - BEGIN / COMMIT
//   - CREATE TABLE IF NOT EXISTS
//   - CREATE INDEX IF NOT EXISTS
//   - pgcrypto extension attempted inside a DO block

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const M1 = readFileSync(
  join(process.cwd(), "migrations", "001_application_data.sql"),
  "utf8",
);
const M2 = readFileSync(
  join(process.cwd(), "migrations", "002_security_indexes.sql"),
  "utf8",
);
const M5 = readFileSync(
  join(process.cwd(), "migrations", "005_phase19_run_recovery.sql"),
  "utf8",
);

test("migrations: 001 begins and commits", () => {
  assert.match(M1, /^\s*BEGIN\s*;/m);
  assert.match(M1, /^\s*COMMIT\s*;/m);
});

test("migrations: 001 creates all required tables", () => {
  for (const t of [
    "users",
    "favorites",
    "comments",
    "notification_preferences",
    "notifications",
    "editorial_items",
    "automation_runs",
    "audit_logs",
    "seo_audits",
    "analytics_events",
  ]) {
    const re = new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`);
    assert.match(M1, re, `table ${t} missing`);
  }
});

test("migrations: 001 enforces idempotency_key UNIQUE", () => {
  assert.match(M1, /idempotency_key\s+text\s+NOT NULL\s+UNIQUE/);
});

test("migrations: 001 uses pgcrypto with safe fallback", () => {
  assert.match(M1, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  assert.match(M1, /EXCEPTION WHEN/);
});

test("migrations: 002 begins and commits", () => {
  assert.match(M2, /^\s*BEGIN\s*;/m);
  assert.match(M2, /^\s*COMMIT\s*;/m);
});

test("migrations: 002 uses IF NOT EXISTS for indexes", () => {
  for (const idx of [
    "idx_users_role_status",
    "idx_automation_status_started",
    "idx_favorites_user",
  ]) {
    assert.match(M2, new RegExp(`CREATE INDEX IF NOT EXISTS ${idx}\\b`));
  }
});

test("migrations: unapplied 004 and 005 leave transaction ownership to the runner", () => {
  const M4 = readFileSync(
    join(process.cwd(), "migrations", "004_password_reset_tokens.sql"),
    "utf8",
  );
  for (const [name, sql] of [["004", M4], ["005", M5]] as const) {
    assert.doesNotMatch(
      sql.replace(/--[^\r\n]*/g, ""),
      /(?:^|;)\s*(?:BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK)\s*;/im,
      `migration ${name} must not terminate the runner-owned transaction`,
    );
  }
});

test("migrations: 005 adds only additive recovery and idempotency structures", () => {
  for (const field of ["stage", "error_class", "updated_at", "recovery_count"]) {
    assert.match(M5, new RegExp(`ADD COLUMN IF NOT EXISTS ${field}\\b`));
  }
  assert.match(M5, /'held_for_content'/);
  assert.match(M5, /'recovery_queued'/);
  assert.match(M5, /automation_run_recoveries/);
  assert.match(M5, /idx_automation_run_recoveries_active/);
  assert.match(M5, /wp_draft_operations/);
  assert.doesNotMatch(M5, /\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP\s+TABLE\b/i);
  assert.match(M5, /CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_run_recoveries_active/);
  assert.match(M5, /PRIMARY KEY REFERENCES automation_runs\(id\)/);
  assert.match(M5, /attempt BETWEEN 0 AND 3/);
});

test("migrations: Phase 19 is source-only and declares reviewed migration ordering", () => {
  const docs = readFileSync(join(process.cwd(), "docs", "PHASE19B-19E-OPERATIONS.md"), "utf8");
  assert.match(docs, /has \*\*not\*\* been applied/);
  assert.match(docs, /apply migration 005 first/);
  assert.match(docs, /WordPress draft #22 is preserved/);
});
