// Tests for /api/automation/approval-status (FIRST SLICE / 003).
//
// Uses the Db override path (lib/db/postgres __setDbOverrideForTest)
// to drive the route through repository behavior without a real PG.

import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/automation/approval-status/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";

const OK_SECRET = "x".repeat(64);
process.env.AUTOMATION_SECRET = OK_SECRET;

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
      if (r instanceof Error) throw r;
      return r as { rows: T[]; rowCount: number | null };
    },
    async end() {
      /* no-op */
    },
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(
    "https://football-factory-three.vercel.app/api/automation/approval-status",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body ?? {}),
    },
  );
}

test("approval-status: missing x-automation-secret → 401", async () => {
  const db = makeStubDb([]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest({ run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7" }),
    );
    assert.equal(r.status, 401);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "automation_secret_invalid");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("approval-status: wrong x-automation-secret → 401", async () => {
  const db = makeStubDb([]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7" },
        { "x-automation-secret": "wrong" },
      ),
    );
    assert.equal(r.status, 401);
  } finally {
    __resetDbOverrideForTest();
  }
});

test("approval-status: correct secret + run_id → pending", async () => {
  // Plan: 1st query resolves run_id to editorial_item_id; 2nd query
  // selects the editorial item.
  const db = makeStubDb([
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 5,
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
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7" },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 200);
    const body = (await r.json()) as {
      approval_state: string;
      editorial_item_id: string;
    };
    assert.equal(body.approval_state, "pending");
    assert.equal(body.editorial_item_id, "i1");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("approval-status: correct secret + approved item → approved", async () => {
  const db = makeStubDb([
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 5,
          stage: "approved",
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
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7" },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 200);
    const body = (await r.json()) as { approval_state: string };
    assert.equal(body.approval_state, "approved");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("approval-status: correct secret + rejected item → rejected", async () => {
  const db = makeStubDb([
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 5,
          stage: "rejected",
          approval_state: "rejected",
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
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7" },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 200);
    const body = (await r.json()) as { approval_state: string };
    assert.equal(body.approval_state, "rejected");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("approval-status: unknown run_id (editorial_item_id is NULL) → 404", async () => {
  const db = makeStubDb([() => ({ rows: [{ editorial_item_id: null }], rowCount: 1 })]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7" },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 404);
  } finally {
    __resetDbOverrideForTest();
  }
});

test("approval-status: unknown editorial_item_id → 404", async () => {
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { editorial_item_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7" },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 404);
  } finally {
    __resetDbOverrideForTest();
  }
});

test("approval-status: empty body → 400 validation_failed", async () => {
  const db = makeStubDb([]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(makeRequest({}, { "x-automation-secret": OK_SECRET }));
    assert.equal(r.status, 400);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "validation_failed");
  } finally {
    __resetDbOverrideForTest();
  }
});
