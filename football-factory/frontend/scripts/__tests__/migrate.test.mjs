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
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hasTransactionControl } from "../migration-safety.mjs";

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

test("migrate: pending migration SQL cannot terminate the runner-owned transaction", () => {
  const migrations = ["004_password_reset_tokens.sql", "005_phase19_run_recovery.sql"];
  for (const name of migrations) {
    const sql = readFileSync(join(REPO, "migrations", name), "utf8");
    assert.equal(hasTransactionControl(sql), false, `${name} contains transaction control`);
  }

  assert.equal(
    hasTransactionControl("CREATE TABLE example(id int);\nCOMMIT;"),
    true,
    "guard detects a premature commit",
  );
  assert.equal(
    hasTransactionControl("-- COMMIT;\nDO $$ BEGIN PERFORM 1; END $$;"),
    false,
    "comments and procedural block keywords are not transaction commands",
  );
  const runner = readFileSync(MIGRATE, "utf8");
  assert.match(runner, /hasTransactionControl\(sql\)/);
  assert.match(runner, /await client\.query\("BEGIN"\);[\s\S]*?await client\.query\(sql\);[\s\S]*?INSERT INTO ff_schema_migrations[\s\S]*?await client\.query\("COMMIT"\)/);
});

function createIsolatedRunnerFixture() {
  const root = mkdtempSync(join(tmpdir(), "ff90-migrate-fixture-"));
  const scriptsDir = join(root, "scripts");
  const migrationsDir = join(root, "migrations");
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(migrationsDir, { recursive: true });
  const runner = readFileSync(MIGRATE, "utf8")
    .replace('import pg from "pg";', 'import pg from "../fake-pg.mjs";');
  writeFileSync(join(scriptsDir, "migrate.mjs"), runner);
  cpSync(join(REPO, "scripts", "migration-safety.mjs"), join(scriptsDir, "migration-safety.mjs"));
  cpSync(join(REPO, "scripts", "__tests__", "fixtures", "fake-pg.mjs"), join(root, "fake-pg.mjs"));
  return { root, scriptsDir, migrationsDir, runnerPath: join(scriptsDir, "migrate.mjs"), statePath: join(root, "state.json") };
}

function runIsolatedRunner(fixture) {
  return spawnSync("node", [fixture.runnerPath], {
    cwd: fixture.root,
    env: {
      ...process.env,
      DATABASE_URL: "postgres://fixture:fixture@127.0.0.1/isolated_test",
      FAKE_PG_STATE_FILE: fixture.statePath,
    },
    encoding: "utf8",
    timeout: 15_000,
  });
}

test("migrate: failed migration rolls back schema and history in isolated fake DB", () => {
  const fixture = createIsolatedRunnerFixture();
  try {
    writeFileSync(
      join(fixture.migrationsDir, "004_fixture_failure.sql"),
      "CREATE TABLE fixture_partial_change(id int);\nSELECT FAIL_MIGRATION;\n",
    );
    const result = runIsolatedRunner(fixture);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    assert.match(result.stdout, /applied=0 skipped=0 failed=1/);
    const state = JSON.parse(readFileSync(fixture.statePath, "utf8"));
    assert.deepEqual(state.history, [], "failed migration must not be recorded");
    assert.deepEqual(state.tables, [], "partial schema change must roll back");
    const migrationEvents = state.events.slice(state.events.lastIndexOf("BEGIN") + 1);
    assert.ok(migrationEvents.includes("ROLLBACK"));
    assert.equal(migrationEvents.includes("COMMIT"), false);
    assert.equal(migrationEvents.some((event) => event.startsWith("INSERT INTO ff_schema_migrations")), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("migrate: isolated repeated execution is idempotent", () => {
  const fixture = createIsolatedRunnerFixture();
  try {
    writeFileSync(join(fixture.migrationsDir, "004_fixture_ok.sql"), "CREATE TABLE fixture_ok(id int);\n");
    const first = runIsolatedRunner(fixture);
    assert.equal(first.status, 0, first.stderr + first.stdout);
    assert.match(first.stdout, /applied=1 skipped=0 failed=0/);
    const firstState = JSON.parse(readFileSync(fixture.statePath, "utf8"));
    assert.deepEqual(firstState.history, ["004_fixture_ok.sql"]);
    assert.deepEqual(firstState.tables, ["fixture_ok"]);

    const second = runIsolatedRunner(fixture);
    assert.equal(second.status, 0, second.stderr + second.stdout);
    assert.match(second.stdout, /applied=0 skipped=1 failed=0/);
    const secondState = JSON.parse(readFileSync(fixture.statePath, "utf8"));
    assert.deepEqual(secondState.history, ["004_fixture_ok.sql"]);
    assert.deepEqual(secondState.tables, ["fixture_ok"]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
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
