// Tests for the 5 pre-n8n backend hook routes (PRE-N8N BACKEND).
//
// Covers:
//   FF_HOOK_3  /api/automation/editorial-item
//   FF_HOOK_4  /api/automation/ai-assist
//   FF_HOOK_5  /api/automation/fact-check
//   FF_HOOK_6  /api/automation/rights-check
//   FF_HOOK_7  /api/automation/seo-check
//
// All routes share the same patterns:
//   - x-automation-secret (401 missing/wrong, 200 ok)
//   - zod validation (400)
//   - database_not_configured (503)
//   - run_not_found / editorial_item_not_found (404)
//   - association_mismatch (409) — run.editorial_item_id != body.editorial_item_id
//   - idempotency on stable hash

import test from "node:test";
import assert from "node:assert/strict";
import { POST as Hook3 } from "@/app/api/automation/editorial-item/route";
import { POST as Hook4 } from "@/app/api/automation/ai-assist/route";
import { POST as Hook5 } from "@/app/api/automation/fact-check/route";
import { POST as Hook6 } from "@/app/api/automation/rights-check/route";
import { POST as Hook7 } from "@/app/api/automation/seo-check/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";

const OK_SECRET = "x".repeat(64);
process.env.AUTOMATION_SECRET = OK_SECRET;
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?sslmode=require";

const RUN_ID = "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7";
const EDITORIAL_ID = "b2c43d6e-7f80-4a91-b2c3-4d5e6f708192";
const OTHER_EDITORIAL_ID = "c3d54e7f-8a91-4b2c-3d4e-5f7081928394";

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
    "https://football-factory-three.vercel.app/api/automation/_test",
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

function editorialRow(overrides: Partial<{
  id: string;
  source_id: string;
  wp_post_id: number | null;
  stage: string;
  approval_state: string;
  approved_by: string | null;
  approved_at: string | null;
  metadata: unknown;
}> = {}) {
  return {
    id: EDITORIAL_ID,
    source_id: "src-test",
    wp_post_id: null,
    stage: "editorial_created",
    approval_state: "pending",
    approved_by: null,
    approved_at: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function runRow(overrides: Partial<{ id: string }> = {}) {
  return {
    id: RUN_ID,
    status: "running",
    input: {},
    output: {},
    idempotency_key: "k-1",
    ...overrides,
  };
}

function withDb<T>(plan: Array<() => unknown>, fn: (db: Db) => Promise<T>): Promise<T> {
  const db = makeStubDb(plan);
  __setDbOverrideForTest(db as unknown as Db);
  return fn(db as unknown as Db).finally(() => __resetDbOverrideForTest());
}

// ----------------------------------------------------------------------
// FF_HOOK_3 — editorial-item create
// ----------------------------------------------------------------------

test("FF_HOOK_3: missing secret → 401", async () => {
  await withDb([], async () => {
    const r = await Hook3(makeRequest({ run_id: RUN_ID, source_id: "src-x" }));
    assert.equal(r.status, 401);
  });
});

test("FF_HOOK_3: wrong secret → 401", async () => {
  await withDb([], async () => {
    const r = await Hook3(
      makeRequest({ run_id: RUN_ID, source_id: "src-x" }, { "x-automation-secret": "wrong" }),
    );
    assert.equal(r.status, 401);
  });
});

test("FF_HOOK_3: run not found → 404", async () => {
  await withDb([() => ({ rows: [], rowCount: 0 })], async () => {
    const r = await Hook3(
      makeRequest(
        { run_id: RUN_ID, source_id: "src-x" },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 404);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "run_not_found");
  });
});

test("FF_HOOK_3: create success → 201 with editorial_item_id", async () => {
  // Plan:
  //   runs.get          → run present
  //   findBySourceId    → empty
  //   create INSERT     → row
  //   UPDATE metadata   → 0 rows (no-op for title-only update path)
  //   findById (re-read)→ row
  //   linkToRun: SELECT → null; UPDATE → returns the linked id
  //   audit_logs INSERT → row
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [], rowCount: 0 }),
      () => ({
        rows: [editorialRow({ stage: "editorial_created" })],
        rowCount: 1,
      }),
      () => ({ rows: [], rowCount: 0 }),
      () => ({
        rows: [editorialRow({ stage: "editorial_created" })],
        rowCount: 1,
      }),
      () => ({ rows: [{ editorial_item_id: null }], rowCount: 1 }),
      () => ({
        rows: [{ editorial_item_id: EDITORIAL_ID }],
        rowCount: 1,
      }),
      () => ({ rows: [{ id: 1 }], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook3(
        makeRequest(
          {
            run_id: RUN_ID,
            source_id: "src-test",
            title: "Hello",
            source_url: "https://example.test",
          },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 201);
      const body = (await r.json()) as {
        editorial_item_id: string;
        created: boolean;
        linked: boolean;
        approval_state: string;
      };
      assert.equal(body.editorial_item_id, EDITORIAL_ID);
      assert.equal(body.created, true);
      assert.equal(body.linked, true);
      assert.equal(body.approval_state, "pending");
    },
  );
});

test("FF_HOOK_3: same source_id → 200 idempotent (no duplicate row)", async () => {
  // Plan:
  //   runs.get       → run present
  //   findBySourceId → row already exists
  //   linkToRun: SELECT → e.id; idempotent (already-linked matching id)
  //   audit_logs INSERT
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [editorialRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({ rows: [{ id: 2 }], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook3(
        makeRequest(
          { run_id: RUN_ID, source_id: "src-test" },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as { created: boolean; linked: boolean };
      assert.equal(body.created, false);
      assert.equal(body.linked, false); // already linked, idempotent
    },
  );
});

test("FF_HOOK_3: run already linked to DIFFERENT editorial_item → 409 incompatible", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [editorialRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: OTHER_EDITORIAL_ID }], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook3(
        makeRequest(
          { run_id: RUN_ID, source_id: "src-test" },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string };
      assert.equal(body.error, "incompatible_run_editorial_link");
    },
  );
});

// ----------------------------------------------------------------------
// FF_HOOK_4 — ai-assist
// ----------------------------------------------------------------------

test("FF_HOOK_4: missing secret → 401", async () => {
  await withDb([], async () => {
    const r = await Hook4(
      makeRequest({ run_id: RUN_ID, editorial_item_id: EDITORIAL_ID }),
    );
    assert.equal(r.status, 401);
  });
});

test("FF_HOOK_4: run missing → 404", async () => {
  await withDb([() => ({ rows: [], rowCount: 0 })], async () => {
    const r = await Hook4(
      makeRequest(
        { run_id: RUN_ID, editorial_item_id: EDITORIAL_ID },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 404);
  });
});

test("FF_HOOK_4: association mismatch → 409", async () => {
  // run.editorial_item_id is null → findByRunId returns null → association_mismatch.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }), // runs.get
      () => ({ rows: [editorialRow()], rowCount: 1 }), // findById
      () => ({ rows: [{ editorial_item_id: null }], rowCount: 1 }), // findByRunId (SELECT)
    ],
    async () => {
      const r = await Hook4(
        makeRequest(
          { run_id: RUN_ID, editorial_item_id: EDITORIAL_ID, content: "x".repeat(50) },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string };
      assert.equal(body.error, "association_mismatch");
    },
  );
});

test("FF_HOOK_4: success → not_configured, persist metadata, audit logged", async () => {
  // Plans:
  //   runs.get → run
  //   findById → editorial at stage=editorial_created
  //   findByRunId SELECT → editorial_item_id=eid
  //   findById (inside findByRunId) → editorial_row (cached) — wait,
  //     findByRunId uses findById internally. Adjust plan accordingly.
  //
  // To keep this test simple, we set the plan so findByRunId returns
  // by SQL alone (the route uses findByRunId which does a SELECT then
  // optionally a findById). We will pre-link with editorial_item_id
  // pointing at the same id, then findByRunId internally re-loads via
  // findById — the SELECT plan must yield the SAME row twice.
  //
  // Plan:
  //   runs.get → run
  //   findById (item) → editorial at stage=editorial_created
  //   findByRunId SELECT (internal) → editorial_item_id = eid
  //   findById (internal re-load) → editorial row
  //   setStage UPDATE (finds current again):
  //       findById SELECT inside setStage → editorial row (stage=editorial_created)
  //       setStage UPDATE → row
  //   ai_assist metadata UPDATE → row
  //   audit_logs INSERT → row
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({
        rows: [editorialRow({ stage: "editorial_created" })],
        rowCount: 1,
      }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [editorialRow({ stage: "editorial_created" })],
        rowCount: 1,
      }),
      () => ({
        rows: [editorialRow({ stage: "editorial_created" })],
        rowCount: 1,
      }),
      () => ({
        rows: [
          editorialRow({
            stage: "ai_assist",
            metadata: {
              ai_assist: {
                provider_status: "not_configured",
                last_hash: "x".repeat(32),
                last_at: "2026-01-02T00:00:00Z",
              },
            },
          }),
        ],
        rowCount: 1,
      }),
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [{ id: 3 }], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook4(
        makeRequest(
          {
            run_id: RUN_ID,
            editorial_item_id: EDITORIAL_ID,
            content: "Hello world, this is the draft body.",
          },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        provider_status: string;
        stage: string;
        idempotent: boolean;
      };
      assert.equal(body.provider_status, "not_configured");
      assert.equal(body.stage, "ai_assist");
      assert.equal(body.idempotent, false);
    },
  );
});

// ----------------------------------------------------------------------
// FF_HOOK_5 — fact-check
// ----------------------------------------------------------------------

test("FF_HOOK_5: cleared without provider → 409 provider_not_configured", async () => {
  // Stage current is "ai_assist" so the forward edge to "fact_check" is allowed.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "ai_assist" })], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "ai_assist" })], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook5(
        makeRequest(
          {
            run_id: RUN_ID,
            editorial_item_id: EDITORIAL_ID,
            state: "cleared",
          },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string };
      assert.equal(body.error, "provider_not_configured_for_cleared_state");
    },
  );
});

test("FF_HOOK_5: pending_manual success with no provider → score=null (no fabrication)", async () => {
  // Stage current is "ai_assist" so the forward edge to "fact_check" is allowed.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "ai_assist" })], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "ai_assist" })], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "ai_assist" })], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            stage: "fact_check",
            metadata: {
              fact_check: {
                provider_status: "not_configured",
                state: "pending_manual",
                hash: "y".repeat(32),
                last_at: "2026-01-02T00:00:00Z",
              },
            },
          }),
        ],
        rowCount: 1,
      }),
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [{ id: 5 }], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook5(
        makeRequest(
          {
            run_id: RUN_ID,
            editorial_item_id: EDITORIAL_ID,
            state: "pending_manual",
            content: "some content for hashing",
            score: 95, // <- human tries to set score; without provider we drop it
          },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        provider_status: string;
        state: string;
        score: number | null;
      };
      assert.equal(body.provider_status, "not_configured");
      assert.equal(body.state, "pending_manual");
      assert.equal(body.score, null); // explicit, never fabricated
    },
  );
});

// ----------------------------------------------------------------------
// FF_HOOK_6 — rights-check
// ----------------------------------------------------------------------

test("FF_HOOK_6: missing secret → 401", async () => {
  await withDb([], async () => {
    const r = await Hook6(
      makeRequest({ run_id: RUN_ID, editorial_item_id: EDITORIAL_ID }),
    );
    assert.equal(r.status, 401);
  });
});

test("FF_HOOK_6: cleared without provider → 409 provider_not_configured", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "fact_check" })], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "fact_check" })], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook6(
        makeRequest(
          {
            run_id: RUN_ID,
            editorial_item_id: EDITORIAL_ID,
            state: "cleared",
          },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
    },
  );
});

test("FF_HOOK_6: default state manual_review → rights_confirmed=false", async () => {
  // Flow: runs.get, route.findById, findByRunId(SELECT, internal findById),
  // setStage(internal findById, UPDATE), rights metadata UPDATE, audit INSERT.
  // Stage current is "fact_check" so the forward edge to "rights_check" is allowed.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "fact_check" })], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "fact_check" })], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "fact_check" })], rowCount: 1 }),
      () => ({ rows: [editorialRow({ stage: "rights_check" })], rowCount: 1 }),
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [{ id: 6 }], rowCount: 1 }),
    ],
    async () => {
      const r = await Hook6(
        makeRequest(
          {
            run_id: RUN_ID,
            editorial_item_id: EDITORIAL_ID,
            // state omitted → defaults to manual_review
            source_url: "https://ff.test/img/hero.jpg",
          },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        state: string;
        rights_confirmed: boolean;
        provider_status: string;
      };
      assert.equal(body.state, "manual_review");
      assert.equal(body.rights_confirmed, false);
      assert.equal(body.provider_status, "not_configured");
    },
  );
});

// ----------------------------------------------------------------------
// FF_HOOK_7 — seo-check
// ----------------------------------------------------------------------

test("FF_HOOK_7: missing secret → 401", async () => {
  await withDb([], async () => {
    const r = await Hook7(
      makeRequest({
        run_id: RUN_ID,
        editorial_item_id: EDITORIAL_ID,
        title: "x",
        content: "y",
      }),
    );
    assert.equal(r.status, 401);
  });
});

test("FF_HOOK_7: malformed slug → 400 validation_failed", async () => {
  await withDb([], async () => {
    const r = await Hook7(
      makeRequest(
        {
          run_id: RUN_ID,
          editorial_item_id: EDITORIAL_ID,
          title: "Good Title",
          content: "body text".repeat(50),
          slug: "BAD SLUG",
        },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 400);
  });
});

test("FF_HOOK_7: deterministic local checks — good payload → score > 50", async () => {
  // Stage current is "rights_check" so the forward edge to "seo_check" is allowed.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),                  // 1: runs.get
      () => ({ rows: [editorialRow({ stage: "rights_check" })], rowCount: 1 }), // 2: findById
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),    // 3: findByRunId SELECT
      () => ({ rows: [editorialRow({ stage: "rights_check" })], rowCount: 1 }), // 4: findById inside findByRunId
      () => ({ rows: [editorialRow({ stage: "rights_check" })], rowCount: 1 }), // 5: findById inside setStage
      () => ({ rows: [editorialRow({ stage: "seo_check" })], rowCount: 1 }),    // 6: setStage UPDATE
      () => ({ rows: [], rowCount: 0 }),                         // 7: SEO metadata UPDATE
      () => ({ rows: [{ id: 7 }], rowCount: 1 }),                // 8: audit_logs INSERT
    ],
    async () => {
      const r = await Hook7(
        makeRequest(
          {
            run_id: RUN_ID,
            editorial_item_id: EDITORIAL_ID,
            title: "Premier League mid-week recap and tactical notes",
            content:
              "Liverpool showed a 4-2-3-1 shape against Chelsea. " +
              "Read the full analysis below. ".repeat(40) +
              "<a href=\"/news/some-internal-link\">related</a>",
            slug: "premier-league-mid-week-recap",
          },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        score: number;
        provider_status: string;
        checks: Array<{ id: string; passed: boolean }>;
      };
      assert.equal(body.provider_status, "not_configured");
      assert.ok(body.score > 50, `score ${body.score} should be > 50`);
    },
  );
});
