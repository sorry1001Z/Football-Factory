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
