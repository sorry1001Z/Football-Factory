// Tests for the AutomationRunRepository (FIRST SLICE).
//
// We use an in-memory Db stub to drive the repo through its happy-path
// and concurrent-submission behavior. The repo converts PostgresError
// kind=CONSTRAINT to "duplicate: false" without throwing.
//
// Concurrent-submission correctness is tested by simulating two calls
// to claim() with the same idempotency_key on a stub that throws
// PostgresError once and then succeeds.

import test from "node:test";
import assert from "node:assert/strict";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { PostgresError } from "@/lib/db/postgres";

type Row = { id: string; idempotency_key: string };

function makeStubDb(plan: Array<() => unknown>) {
  let i = 0;
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    configured: true,
    calls,
    async query<T = Row>(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      const fn = plan[i++] ?? plan[plan.length - 1];
      // The plan can return a value or throw.
      const r = fn();
      // The shape must be { rows, rowCount }.
      if (r instanceof Promise) {
        return (async () => {
          const v = await r;
          if (v instanceof Error) throw v;
          return v as { rows: T[]; rowCount: number | null };
        })();
      }
      if (r instanceof Error) throw r;
      return r as { rows: T[]; rowCount: number | null };
    },
    async end() {
      /* no-op */
    },
  };
}

const SELECT_SQL_RE = /SELECT id FROM automation_runs WHERE idempotency_key/;

test("automation-repo: claim inserts a new row when key is fresh", async () => {
  const db = makeStubDb([
    () => ({ rows: [{ id: "r1" }], rowCount: 1 }),
  ]);
  const repo = new AutomationRunRepository(db as never);
  const r = await repo.claim({ idempotency_key: "k1", workflow: "x", payload: { a: 1 } });
  assert.equal(r.inserted, true);
  assert.equal(r.run_id, "r1");
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO automation_runs/);
});

test("automation-repo: concurrent claim with same key → second returns duplicate=false", async () => {
  // First call: throws PostgresError CONSTRAINT (unique_violation).
  // Second call (the SELECT fallback): returns the existing row.
  const db = makeStubDb([
    () => {
      throw new PostgresError("CONSTRAINT", "pg_constraint_23505");
    },
    () => ({ rows: [{ id: "r-existing" }], rowCount: 1 }),
  ]);
  const repo = new AutomationRunRepository(db as never);
  const r = await repo.claim({ idempotency_key: "k1", workflow: "x", payload: {} });
  assert.equal(r.inserted, false);
  assert.equal(r.run_id, "r-existing");
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[1].sql, SELECT_SQL_RE);
});

test("automation-repo: concurrent claim where SELECT also races → dedupe_race_unresolved", async () => {
  // First call: throws CONSTRAINT.
  // Second call (SELECT): returns 0 rows (extreme race).
  const db = makeStubDb([
    () => {
      throw new PostgresError("CONSTRAINT", "pg_constraint_23505");
    },
    () => ({ rows: [], rowCount: 0 }),
  ]);
  const repo = new AutomationRunRepository(db as never);
  await assert.rejects(
    () => repo.claim({ idempotency_key: "k1", workflow: "x", payload: {} }),
    /dedupe_race_unresolved/,
  );
});

test("automation-repo: claim with non-constraint error → propagates", async () => {
  const db = makeStubDb([
    () => {
      throw new PostgresError("NETWORK", "pg_network_08006");
    },
  ]);
  const repo = new AutomationRunRepository(db as never);
  await assert.rejects(
    () => repo.claim({ idempotency_key: "k1", workflow: "x", payload: {} }),
    (e: unknown) =>
      e instanceof PostgresError && e.kind === "NETWORK",
  );
});

test("automation-repo: setStatus updates status only when terminal", async () => {
  const db = makeStubDb([
    () => ({ rows: [], rowCount: 0 }),
  ]);
  const repo = new AutomationRunRepository(db as never);
  await repo.setStatus("r1", "success", { wp_post_id: 5 });
  const sql = db.calls[0].sql;
  assert.match(sql, /UPDATE automation_runs/);
  assert.match(sql, /finished_at = CASE/);
});
