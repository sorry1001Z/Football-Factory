// Football Factory — PostgreSQL client (FIRST SLICE).
//
// Server-only. Lazy singleton pool. No secret logging. No connection at
// import time — `getDb()` opens the pool on first call. The pool is
// reused across requests in the same Node process (Vercel function
// instance). On serverless, every cold start re-creates the pool; the
// pool's `max` is small (5) to avoid exhausting the database's connection
// limit under bursty traffic.
//
// Required env (server-only):
//   DATABASE_URL    postgresql://user:pass@host:5432/db
//
// Behavior:
//   - If DATABASE_URL is unset: every query throws "DATABASE_URL missing".
//     This is intentional. Production must provision a DB before any
//     application route that calls getDb() is exercised.
//   - Errors are wrapped in a `PostgresError` with `kind` so callers can
//     discriminate (NETWORK, AUTH, NOT_FOUND, CONSTRAINT, INTERNAL).
//   - Never logs the connection string or any password material.

import "server-only";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

export type Db = {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  end(): Promise<void>;
  configured: boolean;
};

export type PostgresErrorKind =
  | "NETWORK"
  | "AUTH"
  | "CONSTRAINT"
  | "NOT_FOUND"
  | "INTERNAL";

export class PostgresError extends Error {
  public readonly kind: PostgresErrorKind;
  public readonly cause?: unknown;
  constructor(kind: PostgresErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "PostgresError";
    this.kind = kind;
    this.cause = cause;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __FF_PG_POOL__: Pool | undefined;
}

function classify(err: unknown): PostgresError {
  // PG node-postgres errors carry a string `code` (SQLSTATE). The
  // driver types are loose, so we read defensively.
  const e = err as { code?: unknown; message?: unknown };
  const code = typeof e?.code === "string" ? e.code : "";
  const msg = typeof e?.message === "string" ? e.message : "pg_error";
  // Postgres SQLSTATE codes (subset that matters for app code).
  if (code === "23505" || code === "23503" || code === "23514") {
    return new PostgresError("CONSTRAINT", `pg_constraint_${code}`, err);
  }
  if (code === "28P01" || code === "28000") {
    return new PostgresError("AUTH", `pg_auth_${code}`, err);
  }
  if (
    code === "08000" ||
    code === "08003" ||
    code === "08006" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03"
  ) {
    return new PostgresError("NETWORK", `pg_network_${code}`, err);
  }
  return new PostgresError("INTERNAL", msg, err);
}

function getPool(): Pool {
  if (globalThis.__FF_PG_POOL__) return globalThis.__FF_PG_POOL__;
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    throw new PostgresError("AUTH", "DATABASE_URL missing");
  }
  const pool = new Pool({
    connectionString: cs,
    max: 5, // small for serverless
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl:
      process.env.PGSSLMODE === "disable"
        ? false
        : { rejectUnauthorized: false },
  });
  // Surface pool-level errors without printing the connection string.
  pool.on("error", (err) => {
    // Use console.warn (not error) to avoid log-alerting on benign
    // idle-client disconnects; do not include connection details.
    const code = typeof (err as { code?: unknown })?.code === "string"
      ? (err as { code?: string }).code
      : "";
    const msg = typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message?: string }).message
      : "";
    console.warn("[pg] pool error", code || msg || "unknown");
  });
  globalThis.__FF_PG_POOL__ = pool;
  return pool;
}

export function getDb(): Db {
  // Test override path. When a test injects a stub via
  // __setDbOverrideForTest(), getDb() returns the stub regardless of
  // DATABASE_URL. This lets route tests exercise repository behavior
  // without standing up a real PG. The test must call
  // __resetDbOverrideForTest() in cleanup.
  const override = globalThis.__FF_DB_OVERRIDE__;
  if (override) return override as Db;
  const configured = Boolean(process.env.DATABASE_URL);
  return {
    configured,
    async query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      values: unknown[] = [],
    ): Promise<{ rows: T[]; rowCount: number | null }> {
      try {
        const r: QueryResult<T> = await getPool().query<T>(sql, values);
        return { rows: r.rows, rowCount: r.rowCount };
      } catch (err) {
        throw classify(err);
      }
    },
    async end(): Promise<void> {
      const p = globalThis.__FF_PG_POOL__;
      if (p) {
        try {
          await p.end();
        } finally {
          globalThis.__FF_PG_POOL__ = undefined;
        }
      }
    },
  };
}

/**
 * Test-only: inject a Db stub that getDb() will return for the
 * duration of the test. Restore with __resetDbOverrideForTest().
 *
 * Intentionally globalThis-scoped so it works across module instances
 * in the test runtime.
 */
declare global {
  // eslint-disable-next-line no-var
  var __FF_DB_OVERRIDE__: Db | undefined;
}

export function __setDbOverrideForTest(db: Db): void {
  globalThis.__FF_DB_OVERRIDE__ = db;
}

export function __resetDbOverrideForTest(): void {
  globalThis.__FF_DB_OVERRIDE__ = undefined;
}

/**
 * Run a function inside a single transaction. The function receives a
 * `tx` Db whose `query` uses the same client. Roll back on any throw.
 */
export async function withTx<T>(
  fn: (tx: Pick<Db, "query">) => Promise<T>,
): Promise<T> {
  if (!process.env.DATABASE_URL) {
    throw new PostgresError("AUTH", "DATABASE_URL missing");
  }
  const pool = getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = {
      async query<T extends QueryResultRow = QueryResultRow>(
        sql: string,
        values: unknown[] = [],
      ): Promise<{ rows: T[]; rowCount: number | null }> {
        try {
          const r = await client.query<T>(sql, values);
          return { rows: r.rows, rowCount: r.rowCount };
        } catch (err) {
          throw classify(err);
        }
      },
    };
    const out = await fn(tx);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore secondary rollback failure */
    }
    throw err;
  } finally {
    client.release();
  }
}
