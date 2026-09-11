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

// --------------------------------------------------------------------------
// PRE-N8N BACKEND — additional repository methods
// --------------------------------------------------------------------------

test("editorial-repo (PRE-N8N): findBySourceId returns null when missing", async () => {
  const db = makeStubDb([
    () => ({ rows: [], rowCount: 0 }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.findBySourceId("src-does-not-exist");
  assert.equal(r, null);
  assert.match(db.calls[0].sql, /WHERE source_id = \$1/);
  assert.equal(db.calls[0].values[0], "src-does-not-exist");
});

test("editorial-repo (PRE-N8N): findBySourceId returns the row when present", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "i-source-1",
          source_id: "src-1",
          wp_post_id: null,
          stage: "editorial_created",
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
  const r = await repo.findBySourceId("src-1");
  assert.ok(r);
  assert.equal(r!.id, "i-source-1");
});

test("editorial-repo (PRE-N8N): linkToRun — first link returns linked=true", async () => {
  const db = makeStubDb([
    // SELECT current link
    () => ({ rows: [{ editorial_item_id: null }], rowCount: 1 }),
    // UPDATE returning the new value
    () => ({ rows: [{ editorial_item_id: "ei-1" }], rowCount: 1 }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.linkToRun("run-1", "ei-1");
  assert.equal(r.linked, true);
  assert.equal(r.conflicting, false);
  assert.equal(r.editorial_item_id, "ei-1");
  assert.match(db.calls[1].sql, /UPDATE automation_runs/);
});

test("editorial-repo (PRE-N8N): linkToRun — already-linked matching id is idempotent", async () => {
  const db = makeStubDb([
    () => ({ rows: [{ editorial_item_id: "ei-1" }], rowCount: 1 }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.linkToRun("run-1", "ei-1");
  assert.equal(r.linked, false);
  assert.equal(r.conflicting, false);
  assert.equal(r.editorial_item_id, "ei-1");
});

test("editorial-repo (PRE-N8N): linkToRun — already-linked to different id is conflicting", async () => {
  const db = makeStubDb([
    () => ({ rows: [{ editorial_item_id: "ei-other" }], rowCount: 1 }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.linkToRun("run-1", "ei-1");
  assert.equal(r.linked, false);
  assert.equal(r.conflicting, true);
  assert.equal(r.editorial_item_id, "ei-other");
});

test("editorial-repo (PRE-N8N): setStage — forward transition succeeds + stage_history appended", async () => {
  // Plan: findById returns current stage=editorial_created;
  // then the UPDATE returns the new row with the appended metadata.
  const db = makeStubDb([
    // findById SELECT
    () => ({
      rows: [
        {
          id: "i-1",
          source_id: "src-1",
          wp_post_id: null,
          stage: "editorial_created",
          approval_state: "pending",
          approved_by: null,
          approved_at: null,
          metadata: { existing: true },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      rowCount: 1,
    }),
    // setStage UPDATE RETURNING
    () => ({
      rows: [
        {
          id: "i-1",
          source_id: "src-1",
          wp_post_id: null,
          stage: "ai_assist",
          approval_state: "pending",
          approved_by: null,
          approved_at: null,
          metadata: {
            existing: true,
            stage_history: [
              {
                from: "editorial_created",
                to: "ai_assist",
                run_id: "run-1",
                note: "FF_HOOK_4",
              },
            ],
          },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:01Z",
        },
      ],
      rowCount: 1,
    }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.setStage("i-1", "ai_assist", "run-1", "FF_HOOK_4");
  assert.equal(r.stage, "ai_assist");
  const hist = (r.metadata as { stage_history?: unknown[] }).stage_history;
  assert.ok(Array.isArray(hist));
  assert.equal(hist!.length, 1);
});

test("editorial-repo (PRE-N8N): setStage — repeat same stage is allowed (idempotent)", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "i-1",
          source_id: "src-1",
          wp_post_id: null,
          stage: "ai_assist",
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
    () => ({
      rows: [
        {
          id: "i-1",
          source_id: "src-1",
          wp_post_id: null,
          stage: "ai_assist",
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
  const r = await repo.setStage("i-1", "ai_assist", "run-1", "repeat");
  assert.equal(r.stage, "ai_assist");
});

test("editorial-repo (PRE-N8N): setStage — backward transition throws", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "i-1",
          source_id: "src-1",
          wp_post_id: null,
          stage: "fact_check",
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
  await assert.rejects(
    () => repo.setStage("i-1", "ai_assist", "run-1"),
    (e: unknown) => e instanceof Error && /Cannot transition/.test(e.message),
  );
});

test("editorial-repo (PRE-N8N): setStage — terminal-to-forward throws", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "i-1",
          source_id: "src-1",
          wp_post_id: null,
          stage: "rejected",
          approval_state: "rejected",
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
  await assert.rejects(
    () => repo.setStage("i-1", "approved", "run-1"),
    (e: unknown) => e instanceof Error && /terminal/.test(e.message),
  );
});

test("editorial-repo (PRE-N8N): create inserts editorial_items row at stage=editorial_created", async () => {
  // Plan:
  //   INSERT RETURNING ... → 1 row
  //   UPDATE metadata      → 1 row (because title is present in input)
  //   findById (re-read)   → 1 row
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "ei-new",
          source_id: "src-new",
          wp_post_id: null,
          stage: "editorial_created",
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
    () => ({ rows: [], rowCount: 0 }), // UPDATE metadata
    () => ({
      rows: [
        {
          id: "ei-new",
          source_id: "src-new",
          wp_post_id: null,
          stage: "editorial_created",
          approval_state: "pending",
          approved_by: null,
          approved_at: null,
          metadata: { title: "My Title" },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      rowCount: 1,
    }),
  ]);
  const repo = new EditorialRepository(db as never);
  const r = await repo.create({
    source_id: "src-new",
    stage: "editorial_created",
    title: "My Title",
  });
  assert.equal(r.stage, "editorial_created");
  assert.equal((r.metadata as { title: string }).title, "My Title");
});

