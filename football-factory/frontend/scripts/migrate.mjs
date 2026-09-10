#!/usr/bin/env node
/**
 * Football Factory — migration runner.
 *
 * Usage:
 *   npm run migrate
 *
 * Behavior:
 *   - reads DATABASE_URL from env (server-only).
 *   - connects via `pg` with SSL-on-by-default (Neon / managed PG friendly).
 *   - creates ff_schema_migrations tracking table if missing.
 *   - reads every *.sql file under migrations/ in deterministic
 *     lexicographic order.
 *   - skips migrations whose filename is already in ff_schema_migrations.
 *   - applies each new migration inside a single transaction; on any
 *     error the transaction is rolled back, the runner exits non-zero,
 *     and the migration is NOT recorded as applied.
 *   - prints a one-line summary per migration (SKIP / PASS / FAIL).
 *   - NEVER prints the connection string, password material, or any
 *     env var value.
 *
 * Intentionally NOT imported into the production runtime. This file is
 * invoked from the command line only.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

const PLACEHOLDER_RE = /(CHANGE_ME|example\.com|replace-with)/i;

/**
 * Redact a database connection string for safe printing. We only ever
 * print this if a sanity-check fails; the routine output never includes
 * the connection string.
 *
 * postgres://user:password@host:port/db?sslmode=require
 *   becomes
 * postgres://*** @host:port/db?sslmode=require
 */
function redact(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//*** @${u.host}${u.pathname}${u.search}`;
  } catch {
    return "postgres://*** (invalid URL)";
  }
}

function safeSummary(filename, status, ms) {
  return `[migrate] ${filename} ${status} (${ms}ms)`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || PLACEHOLDER_RE.test(url)) {
    console.error("[migrate] FAIL: DATABASE_URL missing or placeholder");
    process.exit(2);
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    console.error("[migrate] FAIL: DATABASE_URL must be postgres:// or postgresql://");
    process.exit(2);
  }

  // Discover SQL files in deterministic lexicographic order.
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch (err) {
    console.error(`[migrate] FAIL: cannot read migrations dir (${MIGRATIONS_DIR})`);
    console.error(`[migrate] ${err?.message ?? String(err)}`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.error("[migrate] FAIL: no .sql files found in migrations/");
    process.exit(2);
  }

  // Establish pool. SSL on by default for managed PG (Neon / RDS).
  const pool = new pg.Pool({
    connectionString: url,
    ssl:
      process.env.PGSSLMODE === "disable"
        ? false
        : { rejectUnauthorized: false },
    max: 1, // one connection is enough; simpler
    connectionTimeoutMillis: 10_000,
  });

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  const client = await pool.connect().catch((err) => {
    console.error(`[migrate] FAIL: cannot connect: ${err?.message ?? String(err)}`);
    console.error(`[migrate] connection string: ${redact(url)}`);
    process.exit(2);
  });

  try {
    await client.query("BEGIN");
    // Create tracking table (idempotent).
    await client.query(`
      CREATE TABLE IF NOT EXISTS ff_schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL DEFAULT '',
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error(`[migrate] FAIL: cannot create ff_schema_migrations: ${err?.message ?? String(err)}`);
    client.release();
    await pool.end().catch(() => {});
    process.exit(1);
  }

  // Read the set of applied migration names.
  let appliedSet;
  try {
    const r = await client.query("SELECT name FROM ff_schema_migrations");
    appliedSet = new Set(r.rows.map((row) => row.name));
  } catch (err) {
    console.error(`[migrate] FAIL: cannot read ff_schema_migrations: ${err?.message ?? String(err)}`);
    client.release();
    await pool.end().catch(() => {});
    process.exit(1);
  }

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(safeSummary(file, "SKIP", 0));
      skipped += 1;
      continue;
    }

    const sqlPath = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(sqlPath, "utf8");
    const checksum = createHash("sha256").update(sql, "utf8").digest("hex").slice(0, 32);

    const t0 = Date.now();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO ff_schema_migrations (name, checksum) VALUES ($1, $2)",
        [file, checksum],
      );
      await client.query("COMMIT");
      console.log(safeSummary(file, "PASS", Date.now() - t0));
      applied += 1;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore secondary rollback failure */
      }
      console.error(safeSummary(file, "FAIL", Date.now() - t0));
      console.error(`[migrate]   reason: ${err?.message ?? String(err)}`);
      failed += 1;
      break;
    }
  }

  client.release();
  await pool.end().catch(() => {});

  console.log(
    `[migrate] done: applied=${applied} skipped=${skipped} failed=${failed}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`[migrate] FAIL: unexpected: ${err?.message ?? String(err)}`);
  process.exit(1);
});
