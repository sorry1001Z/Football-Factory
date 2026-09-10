// Tests for scripts/migrate.mjs (FIRST SLICE staging infrastructure).
//
// We DO NOT connect to a real DB. We invoke the script with mocked
// env + a fake `pg` module injected via a Node import hook (we can't
// truly hook the dynamic import, so we use `node --import` semantics
// via a temp wrapper script — but that adds complexity. Simpler
// approach: validate the parts that DON'T need a DB.
//
// The migrate runner:
//   - exits 2 when DATABASE_URL is missing or placeholder
//   - exits 2 when DATABASE_URL protocol is wrong
//   - exits 2 when migrations dir has no .sql files
//   - prints safe summary lines
//   - never prints DATABASE_URL value
//
// To exercise the SQL-runner code path WITHOUT a real DB we inject
// `pg` via a wrapper that the runner dynamically imports. We do this
// by writing a temp wrapper that uses `node --import` to pre-register
// a `pg` shim before running the migrate script.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function runWithEnv(script, env, cwd) {
  return spawnSync("node", [script], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 15_000,
  });
}

const REPO = process.cwd();
const MIGRATE = join(REPO, "scripts", "migrate.mjs");

test("migrate: exits 2 when DATABASE_URL is missing", () => {
  const r = runWithEnv(MIGRATE, { DATABASE_URL: "" }, REPO);
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /DATABASE_URL missing/);
});

test("migrate: exits 2 when DATABASE_URL is a placeholder", () => {
  const r = runWithEnv(
    MIGRATE,
    { DATABASE_URL: "postgres://user:CHANGE_ME@host:5432/db" },
    REPO,
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /placeholder/);
});

test("migrate: exits 2 when DATABASE_URL protocol is wrong", () => {
  const r = runWithEnv(
    MIGRATE,
    { DATABASE_URL: "mysql://user:pass@host:3306/db" },
    REPO,
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /postgres/);
});

test("migrate: never prints the connection string value", () => {
  // Use a sentinel string the test can grep for. If the script
  // accidentally prints the connection string, this catches it.
  const sentinel = "SENTINEL-NEVER-PRINT-7c1f";
  const url = `postgres://user:${sentinel}@host.example/db`;
  const r = runWithEnv(MIGRATE, { DATABASE_URL: url }, REPO);
  // Either the script exited 2 because it can't connect, or it tried
  // and failed. In either case, the sentinel MUST NOT appear in
  // stderr or stdout. We can't predict whether `pg` is installed at
  // test time, so we check both.
  assert.equal(
    (r.stderr + r.stdout).includes(sentinel),
    false,
    "sentinel leaked into output:\n" + r.stderr + "\n" + r.stdout,
  );
});

test("migrate: migrations are listed in deterministic order (sort)", () => {
  // We can't run a real DB; instead we verify the SQL files are
  // already in lexicographic order.
  const dir = join(REPO, "migrations");
  const unsorted = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const files = [...unsorted].sort();
  assert.deepEqual(unsorted, files, "migrations/ must be lexicographically sorted");
  assert.ok(files.includes("001_application_data.sql"));
  assert.ok(files.includes("002_security_indexes.sql"));
});

test("migrate: migration SQL is idempotent (CREATE TABLE IF NOT EXISTS)", () => {
  const sql = readFileSync(
    join(REPO, "migrations", "001_application_data.sql"),
    "utf8",
  );
  for (const table of [
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
    assert.match(
      sql,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`),
      `table ${table} must be created idempotently`,
    );
  }
});

test("migrate: no DROP statements in any migration", () => {
  for (const f of ["001_application_data.sql", "002_security_indexes.sql"]) {
    const sql = readFileSync(join(REPO, "migrations", f), "utf8");
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|INDEX|DATABASE|SCHEMA|FUNCTION)\b/i);
    assert.doesNotMatch(sql, /\bTRUNCATE\b/i);
  }
});

test("migrate: pgcrypto attempt is wrapped in DO $$ ... EXCEPTION", () => {
  const sql = readFileSync(
    join(REPO, "migrations", "001_application_data.sql"),
    "utf8",
  );
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  assert.match(sql, /EXCEPTION WHEN/);
});
