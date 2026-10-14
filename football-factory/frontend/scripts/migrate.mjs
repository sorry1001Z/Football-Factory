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
import { hasTransactionControl } from "./migration-safety.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

const PLACEHOLDER_RE = /(CHANGE_ME|example\.com|replace-with)/i;

function safeSqlState(err) {
  const code = typeof err?.code === "string" ? err.code : "";
  return /^[0-9A-Z]{5}$/.test(code) ? code : "unavailable";
}

function postgresConnectionConfig(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL invalid");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL invalid");
  }

  const urlMode = url.searchParams.get("sslmode") || undefined;
  const envMode = process.env.PGSSLMODE || undefined;
  const modes = ["disable", "require", "verify-ca", "verify-full"];
  if ((urlMode && !modes.includes(urlMode)) || (envMode && !modes.includes(envMode))) {
    throw new Error("PostgreSQL SSL mode invalid");
  }
  const mode = envMode || urlMode || "verify-full";
  if (mode === "disable") {
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
    if (process.env.NODE_ENV === "production" || !loopbackHosts.has(url.hostname)) {
      throw new Error("PostgreSQL TLS required except for non-production loopback databases");
    }
  }

  const certParams = ["sslrootcert", "sslcert", "sslkey"];
  if (url.searchParams.has("sslcert") || url.searchParams.has("sslkey")) {
    throw new Error("Client-certificate PostgreSQL authentication is unsupported");
  }
  if (certParams.some((name) => url.searchParams.has(name)) && !process.env.PGSSL_CA_CERT) {
    throw new Error("Custom PostgreSQL certificate parameters are unsupported; configure PGSSL_CA_CERT");
  }
  for (const name of ["sslmode", ...certParams, "sslpassword"]) url.searchParams.delete(name);
  return {
    connectionString: url.toString(),
    ssl: mode === "disable"
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.PGSSL_CA_CERT ? { ca: process.env.PGSSL_CA_CERT } : {}),
        },
  };
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
    console.error("[migrate] FAIL: cannot read migrations directory");
    process.exit(2);
  }
  if (files.length === 0) {
    console.error("[migrate] FAIL: no .sql files found in migrations/");
    process.exit(2);
  }

  // Establish a verified TLS connection by default. URL options are
  // stripped because node-postgres may otherwise override the explicit SSL
  // object with connection-string parsing.
  let connectionConfig;
  try {
    connectionConfig = postgresConnectionConfig(url);
  } catch {
    console.error("[migrate] FAIL: DATABASE_URL TLS configuration invalid");
    process.exit(2);
  }
  const pool = new pg.Pool({
    ...connectionConfig,
    max: 1, // one connection is enough; simpler
    connectionTimeoutMillis: 10_000,
  });

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  const client = await pool.connect().catch((err) => {
    console.error(`[migrate] FAIL: cannot connect (SQLSTATE ${safeSqlState(err)})`);
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
    console.error(`[migrate] FAIL: cannot create migration history (SQLSTATE ${safeSqlState(err)})`);
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
    console.error(`[migrate] FAIL: cannot read migration history (SQLSTATE ${safeSqlState(err)})`);
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
      if (hasTransactionControl(sql)) {
        throw new Error("migration SQL must not control the runner-owned transaction");
      }
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
      console.error(`[migrate]   SQLSTATE: ${safeSqlState(err)}`);
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
  console.error(`[migrate] FAIL: unexpected (SQLSTATE ${safeSqlState(err)})`);
  process.exit(1);
});
