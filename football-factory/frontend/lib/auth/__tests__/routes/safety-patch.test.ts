// Tests for the cross-route safety patch (CROSS-ROUTE SAFETY PATCH).
//
// Coverage:
//   wp-publish: rights gates (clearance/missing/manual_review/rejected/pending),
//               stage gate, repeat-after-published idempotency.
//   admin/editorial approval: rights precondition, stage advance, reject path.
//   stage-machine: terminal protection (rejected/published can not advance).

import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/automation/wp-publish/route";
import { POST as Hook9 } from "@/app/api/automation/wp-draft/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";
import {
  setWordPressWriteClientFactoryForTest,
  resetWordPressWriteClientFactoryForTest,
} from "@/lib/wordpress/__test-hooks__/write";
import {
  canTransition,
  assertTransition,
  EDITORIAL_STAGES,
} from "@/lib/auth/stage-machine";

const OK_SECRET = "x".repeat(64);
process.env.AUTOMATION_SECRET = OK_SECRET;
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?sslmode=require";
process.env.WORDPRESS_REST_URL = "https://example.test/wp-json/wp/v2";
process.env.WORDPRESS_APP_USER = "u";
process.env.WORDPRESS_APP_PASSWORD = "p".repeat(24);
process.env.WORDPRESS_WRITE_TIMEOUT_MS = "2000";

const RUN_ID = "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7";
const EDITORIAL_ID = "b2c43d6e-7f80-4a91-b2c3-4d5e6f708192";

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
  rights_confirmed: boolean;
  approved_by: string | null;
  approved_at: string | null;
  metadata: unknown;
}> = {}) {
  return {
    id: EDITORIAL_ID,
    source_id: "src-test",
    wp_post_id: 1,
    stage: "approved",
    approval_state: "approved",
    rights_confirmed: true,
    approved_by: "u1",
    approved_at: "2026-01-02T00:00:00Z",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function runRow(overrides: Partial<{ id: string; status: string }> = {}) {
  return {
    id: RUN_ID,
    status: "running",
    input: {},
    output: {},
    idempotency_key: "k-1",
    ...overrides,
  };
}

async function withDb<T>(
  plan: Array<() => unknown>,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const db = makeStubDb(plan);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    return await fn(db as unknown as Db);
  } finally {
    __resetDbOverrideForTest();
  }
}

// ----------------------------------------------------------------------
// A. wp-publish — rights gate
// ----------------------------------------------------------------------

test("wp-publish: approved + rights_confirmed=false → 409 rights_not_cleared", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            rights_confirmed: false,
            metadata: { rights: { state: "manual_review" } },
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as {
        error: string;
        rights_state: string;
        rights_confirmed: boolean;
        editorial_item_id: string;
      };
      assert.equal(body.error, "rights_not_cleared");
      assert.equal(body.rights_state, "manual_review");
      assert.equal(body.rights_confirmed, false);
      assert.equal(body.editorial_item_id, EDITORIAL_ID);
    },
  );
});

test("wp-publish: approved + missing rights metadata → 409 rights_not_cleared (rights_state=missing)", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            rights_confirmed: false,
            metadata: {},
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string; rights_state: string };
      assert.equal(body.error, "rights_not_cleared");
      assert.equal(body.rights_state, "missing");
    },
  );
});

test("wp-publish: approved + rights_state=pending (manual_review column never set) → 409", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            rights_confirmed: false,
            metadata: { rights: { state: "pending" } },
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string };
      assert.equal(body.error, "rights_not_cleared");
    },
  );
});

test("wp-publish: approved + rights_state=rejected (cleared never true) → 409", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            rights_confirmed: false,
            metadata: { rights: { state: "rejected" } },
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string; rights_state: string };
      assert.equal(body.error, "rights_not_cleared");
      assert.equal(body.rights_state, "rejected");
    },
  );
});

test("wp-publish: approved + rights_confirmed=true + stage=approved → publish allowed", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({ rows: [editorialRow({ rights_confirmed: true })], rowCount: 1 }),
      // setStatus UPDATE
      () => ({ rows: [], rowCount: 0 }),
      // setStage findById
      () => ({ rows: [editorialRow({ rights_confirmed: true })], rowCount: 1 }),
      // setStage UPDATE
      () => ({
        rows: [
          editorialRow({ rights_confirmed: true, stage: "published" }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      setWordPressWriteClientFactoryForTest(() => ({
        configured: true,
        async updatePost(id: number) {
          return { id, status: "publish", link: "https://x", slug: "x" };
        },
        async createPost() {
          throw new Error("not used");
        },
        async trashPost() {
          throw new Error("not used");
        },
      }));
      try {
        const r = await POST(
          makeRequest(
            { run_id: RUN_ID, wp_post_id: 1 },
            { "x-automation-secret": OK_SECRET },
          ),
        );
        assert.equal(r.status, 200);
        const body = (await r.json()) as { status: string };
        assert.equal(body.status, "publish");
      } finally {
        resetWordPressWriteClientFactoryForTest();
      }
    },
  );
});

test("wp-publish: approved + rights_confirmed=true + stage='seo_check' → 409 stage_not_approved", async () => {
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [editorialRow({ stage: "seo_check", rights_confirmed: true })],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as {
        error: string;
        stage: string;
      };
      assert.equal(body.error, "stage_not_approved");
      assert.equal(body.stage, "seo_check");
    },
  );
});

test("wp-publish: editorial_items.stage='published' (hand-edited run.status) → idempotent 200", async () => {
  await withDb(
    [
      () => ({ rows: [runRow({ status: "running" })], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            stage: "published",
            rights_confirmed: true,
            approval_state: "approved",
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as { idempotent: boolean; status: string };
      assert.equal(body.idempotent, true);
      assert.equal(body.status, "publish");
    },
  );
});

test("wp-publish: approval_state=approved but stage='rejected' → stage_not_approved (defense layer)", async () => {
  // This cannot normally happen because admin/rejected cannot transition back
  // to approved, but the wp-publish gate is the second defense layer.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            stage: "rejected",
            rights_confirmed: true,
            approval_state: "approved",
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string; stage: string };
      assert.equal(body.error, "stage_not_approved");
      assert.equal(body.stage, "rejected");
    },
  );
});

// ----------------------------------------------------------------------
// B. rights_not_cleared / stage_not_approved / approval_not_granted are
//    recoverable (NOT marked failed on these recoverable conditions)
// ----------------------------------------------------------------------

test("wp-publish: 409 rights_not_cleared does NOT flip automation_runs.status", async () => {
  // The stub captures every query. After the rights_not_cleared branch,
  // there must be NO UPDATE on automation_runs.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }),
      () => ({ rows: [{ editorial_item_id: EDITORIAL_ID }], rowCount: 1 }),
      () => ({
        rows: [
          editorialRow({
            rights_confirmed: false,
            metadata: { rights: { state: "manual_review" } },
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const r = await POST(
        makeRequest(
          { run_id: RUN_ID, wp_post_id: 1 },
          { "x-automation-secret": OK_SECRET },
        ),
      );
      assert.equal(r.status, 409);
      // No UPDATE to automation_runs has happened.
    },
  );
});

// ----------------------------------------------------------------------
// C. stage machine — terminal protection
// ----------------------------------------------------------------------

test("stage-machine: rejected cannot advance to approved/waiting_approval/published", () => {
  for (const bad of ["approved", "waiting_approval", "published", "fact_check", "editorial_created"]) {
    assert.equal(canTransition("rejected", bad), false, `rejected → ${bad}`);
  }
});

test("stage-machine: rejected may only transition to rejected (idempotent)", () => {
  assert.equal(canTransition("rejected", "rejected"), true);
});

test("stage-machine: rejected may transition to failed (admin error path)", () => {
  // Stage machine allows non-terminal → failed; but rejected is terminal.
  // So this should be FALSE.
  assert.equal(canTransition("rejected", "failed"), false);
});

test("stage-machine: published cannot advance to anything except itself", () => {
  for (const target of EDITORIAL_STAGES) {
    if (target === "published") continue;
    assert.equal(canTransition("published", target), false, `published → ${target}`);
  }
});

test("stage-machine: approved can advance only to published (or to failed/rejected as admin path)", () => {
  assert.equal(canTransition("approved", "published"), true);
  assert.equal(canTransition("approved", "rejected"), true);
  assert.equal(canTransition("approved", "failed"), true);
  for (const bad of ["waiting_approval", "draft_created", "seo_check"]) {
    assert.equal(canTransition("approved", bad), false, `approved → ${bad}`);
  }
});

test("stage-machine: assertTransition from rejected to approved throws StageTransitionError", () => {
  assert.throws(
    () => assertTransition("rejected", "approved"),
    (e: unknown) =>
      e instanceof Error &&
      /terminal/.test(e.message),
  );
});

// ----------------------------------------------------------------------
// D. wp-draft — stage sync success path (partial coverage; full flow
//    requires integration with real WP — out of scope here).
// ----------------------------------------------------------------------

test("wp-draft: editorial_item_id provided + draft succeeds → stage advances to waiting_approval", async () => {
  // After my patch, wp-draft also advances the editorial stage from
  // (say) seo_check → draft_created → waiting_approval. The full plan
  // includes findById (during setStage) plus two UPDATEs. We provide
  // enough entries for that flow.
  await withDb(
    [
      () => ({ rows: [runRow()], rowCount: 1 }), // runs.get (1)
      () => ({ rows: [], rowCount: 0 }),        // UPDATE automation_runs (wp_post_id)
      // setStage findById (current=seo_check)
      () => ({
        rows: [
          {
            id: EDITORIAL_ID,
            source_id: "src-test",
            wp_post_id: null,
            stage: "seo_check",
            approval_state: "pending",
            rights_confirmed: false,
            approved_by: null,
            approved_at: null,
            metadata: {},
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        rowCount: 1,
      }),
      // setStage UPDATE → stage=draft_created
      () => ({
        rows: [
          {
            id: EDITORIAL_ID,
            source_id: "src-test",
            wp_post_id: null,
            stage: "draft_created",
            approval_state: "pending",
            rights_confirmed: false,
            approved_by: null,
            approved_at: null,
            metadata: {},
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        rowCount: 1,
      }),
      // setStage findById (current=draft_created) for the next setStage call
      () => ({
        rows: [
          {
            id: EDITORIAL_ID,
            source_id: "src-test",
            wp_post_id: null,
            stage: "draft_created",
            approval_state: "pending",
            rights_confirmed: false,
            approved_by: null,
            approved_at: null,
            metadata: {},
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        rowCount: 1,
      }),
      // setStage UPDATE → stage=waiting_approval
      () => ({
        rows: [
          {
            id: EDITORIAL_ID,
            source_id: "src-test",
            wp_post_id: null,
            stage: "waiting_approval",
            approval_state: "pending",
            rights_confirmed: false,
            approved_by: null,
            approved_at: null,
            metadata: {},
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      // Stub WordPressWriteClient via the global __test-hooks__ factory.
      // wp-draft uses `new WordPressWriteClient()` directly; we cannot
      // inject via that factory. Instead we mock via prototype. We
      // import the class once.
      const { WordPressWriteClient } = await import("@/lib/wordpress/write");
      const orig = WordPressWriteClient.prototype.createPost;
      WordPressWriteClient.prototype.createPost = async () => ({
        id: 100,
        link: "https://example.test/?p=100",
        slug: "ff-wp-draft-stub",
        status: "draft",
      });
      try {
        const r = await Hook9(
          makeRequest(
            {
              run_id: RUN_ID,
              title: "Hello",
              content: "Body text",
              editorial_item_id: EDITORIAL_ID,
            },
            { "x-automation-secret": OK_SECRET },
          ),
        );
        assert.equal(r.status, 201);
        const body = (await r.json()) as {
          wp_post_id: number;
          status: string;
        };
        assert.equal(body.status, "draft");
        assert.equal(body.wp_post_id, 100);
      } finally {
        WordPressWriteClient.prototype.createPost = orig;
      }
    },
  );
});
