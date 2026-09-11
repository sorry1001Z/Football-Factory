// Tests for the EditorialRepository (FIRST SLICE / 003).
//
// Covers approval_state semantics: pending by default; approved/rejected
// settable via setApproval; findByRunId returns the linked item only
// when automation_runs.editorial_item_id is set.

import test from "node:test";
import assert from "node:assert/strict";
import { EditorialRepository, type ApprovalState } from "@/lib/auth/editorial-repository";

type Row = Record<string, unknown>;

function makeStubDb(plan: Array<() => unknown>) {
  let i = 0;
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    configured: true,
    calls,
    async query<T = Row>(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      const fn = plan[i++] ?? plan[plan.length - 1];
      const r = fn();
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

test("editorial-repo: findById returns null when missing", async () => {
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.findById("a1e32f5a-06ff-40ff-a1f0-148cf33e09d7");
  assert.equal(r, null);
  assert.match(db.calls[0].sql, /FROM editorial_items/);
});

test("editorial-repo: findById returns the row when present", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7",
          source_id: "src-1",
          wp_post_id: 42,
          stage: "drafted",
          approval_state: "pending",
          approved_by: null,
          approved_at: null,
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      rowCount: 1,
    }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.findById("a1e32f5a-06ff-40ff-a1f0-148cf33e09d7");
  assert.ok(r);
  assert.equal(r!.approval_state, "pending");
  assert.equal(r!.wp_post_id, 42);
});

test("editorial-repo: findByWpPostId queries with the post id", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "id-1",
          source_id: "src-1",
          wp_post_id: 99,
          stage: "drafted",
          approval_state: "approved",
          approved_by: "u1",
          approved_at: "2026-01-02T00:00:00Z",
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ],
      rowCount: 1,
    }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.findByWpPostId(99);
  assert.ok(r);
  assert.equal(r!.approval_state, "approved");
  assert.equal(db.calls[0].values[0], 99);
});

test("editorial-repo: findByRunId returns null when automation_runs.editorial_item_id is NULL", async () => {
  // First query: SELECT editorial_item_id FROM automation_runs WHERE id=$1 → null.
  // The repo must return null without a follow-up findById call.
  const db = makeStubDb([
    () => ({ rows: [{ editorial_item_id: null }], rowCount: 1 }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.findByRunId("run-1");
  assert.equal(r, null);
  assert.equal(db.calls.length, 1);
});

test("editorial-repo: findByRunId resolves to the linked editorial item", async () => {
  const db = makeStubDb([
    () => ({ rows: [{ editorial_item_id: "item-1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "item-1",
          source_id: "src-1",
          wp_post_id: 7,
          stage: "drafted",
          approval_state: "approved",
          approved_by: "u1",
          approved_at: "2026-01-02T00:00:00Z",
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ],
      rowCount: 1,
    }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.findByRunId("run-1");
  assert.ok(r);
  assert.equal(r!.id, "item-1");
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[0].sql, /SELECT editorial_item_id FROM automation_runs/);
  assert.match(db.calls[1].sql, /FROM editorial_items/);
});

test("editorial-repo: setApproval sets state, actor, and timestamp", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "item-1",
          source_id: "src-1",
          wp_post_id: 7,
          stage: "drafted",
          approval_state: "approved",
          approved_by: "actor-1",
          approved_at: "2026-01-02T00:00:00Z",
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ],
      rowCount: 1,
    }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.setApproval("item-1", "approved", "actor-1");
  assert.equal(r.approval_state, "approved");
  assert.equal(r.approved_by, "actor-1");
  // SQL must include the state, the actor, and now()
  const sql = db.calls[0].sql;
  assert.match(sql, /UPDATE editorial_items/);
  assert.match(sql, /approval_state = \$2/);
  assert.match(sql, /approved_by\s*=\s*\$3/);
  assert.match(sql, /approved_at\s*=\s*now\(\)/);
  const values = db.calls[0].values;
  assert.deepEqual(values, ["item-1", "approved", "actor-1"]);
});

test("editorial-repo: setApproval rejects pending (only approved/rejected allowed)", async () => {
  // TypeScript compile-time check: setApproval's parameter type excludes
  // "pending". Runtime check would be redundant. We confirm the
  // signature here.
  const repo: EditorialRepository = new EditorialRepository({} as never);
  type SetApprovalArg = Parameters<typeof repo.setApproval>[1];
  // Compile-time: SetApprovalArg is Exclude<ApprovalState, "pending">.
  const _ok: SetApprovalArg = "approved";
  const _ok2: SetApprovalArg = "rejected";
  // @ts-expect-error "pending" must not be assignable
  const _bad: SetApprovalArg = "pending";
  void _ok; void _ok2; void _bad;
  assert.ok(true);
});

test("editorial-repo: listByApprovalState filters and orders", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "s1",
          wp_post_id: 1,
          stage: "drafted",
          approval_state: "pending",
          approved_by: null,
          approved_at: null,
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "i2",
          source_id: "s2",
          wp_post_id: 2,
          stage: "drafted",
          approval_state: "pending",
          approved_by: null,
          approved_at: null,
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      rowCount: 2,
    }),
  ]);
  const repo = new EditorialRepository(db as never);
  const items = await repo.listByApprovalState("pending", 50);
  assert.equal(items.length, 2);
  const values = db.calls[0].values;
  assert.equal(values[0], "pending");
  assert.equal(values[1], 50);
  // Suppress unused-var warning for the ApprovalState import which is
  // only used at compile time.
  void (null as ApprovalState | null);
});
