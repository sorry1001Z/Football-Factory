// Tests for /api/automation/wp-publish (FIRST SLICE / 003).
//
// Focus: the wp-publish decision tree, since the repository and the
// WordPressWriteClient are independently tested.
//
// Cases:
//   - missing secret → 401
//   - wrong secret → 401
//   - run not found → 404
//   - run already success → 200 idempotent
//   - editorial link missing (run.editorial_item_id is NULL) → 409
//   - editorial item wp_post_id mismatch → 409
//   - approval_state=pending → 409
//   - approval_state=rejected → 409
//   - approval_state=approved + WP configured + WP succeeds → 200
//   - WP timeout → 502
//   - WP network error → 502
//   - WP 4xx → 400
//
// The WordPressWriteClient is mocked by stubbing its prototype methods.

import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/automation/wp-publish/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";
import {
  WordPressWriteClient,
  WordPressWriteError,
} from "@/lib/wordpress/write";
import {
  setWordPressWriteClientFactoryForTest,
  resetWordPressWriteClientFactoryForTest,
} from "@/lib/wordpress/__test-hooks__/write";

const OK_SECRET = "x".repeat(64);
process.env.AUTOMATION_SECRET = OK_SECRET;
process.env.WORDPRESS_REST_URL = "https://example.test/wp-json/wp/v2";
process.env.WORDPRESS_APP_USER = "u";
process.env.WORDPRESS_APP_PASSWORD = "p".repeat(24);
process.env.WORDPRESS_WRITE_TIMEOUT_MS = "2000";

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
  return new Request("https://football-factory-three.vercel.app/api/automation/wp-publish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body ?? {}),
  });
}

test("wp-publish: missing x-automation-secret → 401", async () => {
  const db = makeStubDb([]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest({ run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 }),
    );
    assert.equal(r.status, 401);
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: wrong secret → 401", async () => {
  const db = makeStubDb([]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": "wrong" },
      ),
    );
    assert.equal(r.status, 401);
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: run not found → 404", async () => {
  // Plan: 1st query (run.get) returns null.
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 404);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "run_not_found");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: run already success → 200 idempotent (no duplicate publish)", async () => {
  // Plan: 1st query (run.get) returns status='success' with wp_post_id in output.
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "success",
          input: {},
          output: { wp_post_id: 1, wp_status: "publish" },
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 200);
    const body = (await r.json()) as { idempotent: boolean; wp_post_id: number; status: string };
    assert.equal(body.idempotent, true);
    assert.equal(body.wp_post_id, 1);
    assert.equal(body.status, "publish");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: editorial link missing (run.editorial_item_id NULL) → 409 editorial_link_missing", async () => {
  // Plan: run.get (status='running', no editorial_item_id resolution); then
  // EditorialRepository.findByRunId queries: 1st SELECT editorial_item_id
  // returns NULL.
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: null }], rowCount: 1 }),
    // The route then calls setStatus('failed', ...). Provide a stub UPDATE.
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 409);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "editorial_link_missing");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: editorial item wp_post_id mismatch → 409 wp_post_mismatch", async () => {
  // Plan: run.get + findByRunId returns item with wp_post_id=99; the
  // request asks for wp_post_id=1.
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 99,
          stage: "approved",
          rights_confirmed: true,
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
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 409);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "wp_post_mismatch");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: approval_state=pending → 409 approval_not_granted", async () => {
  // Plan: run.get, findByRunId, findById (returns pending).
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
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
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 409);
    const body = (await r.json()) as { error: string; approval_state: string };
    assert.equal(body.error, "approval_not_granted");
    assert.equal(body.approval_state, "pending");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: approval_state=rejected → 409 approval_not_granted", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
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
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  try {
    const r = await POST(
      makeRequest(
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 409);
    const body = (await r.json()) as { error: string; approval_state: string };
    assert.equal(body.error, "approval_not_granted");
    assert.equal(body.approval_state, "rejected");
  } finally {
    __resetDbOverrideForTest();
  }
});

test("wp-publish: approval_state=approved + WP succeeds → 200 publish", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
          stage: "approved",
          rights_confirmed: true,
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
    // setStatus UPDATE after successful publish.
    () => ({ rows: [], rowCount: 0 }),
    // setStage: findById (current=approved)
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
          stage: "approved",
          rights_confirmed: true,
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
    // setStage UPDATE → row at stage="published"
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
          stage: "published",
          rights_confirmed: true,
          approval_state: "approved",
          approved_by: "u1",
          approved_at: "2026-01-02T00:00:00Z",
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:01Z",
        },
      ],
      rowCount: 1,
    }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  // Stub WordPressWriteClient.updatePost to return success.
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
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 200);
    const body = (await r.json()) as { status: string; wp_post_id: number };
    assert.equal(body.status, "publish");
    assert.equal(body.wp_post_id, 1);
  } finally {
    resetWordPressWriteClientFactoryForTest();
    __resetDbOverrideForTest();
  }
});

test("wp-publish: WP timeout → 502 with kind=timeout", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
          stage: "approved",
          rights_confirmed: true,
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
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async updatePost() {
      throw new WordPressWriteError("timeout", "wp_timeout", null);
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
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 502);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "timeout");
  } finally {
    resetWordPressWriteClientFactoryForTest();
    __resetDbOverrideForTest();
  }
});

test("wp-publish: WP network error → 502 with kind=network", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
          stage: "approved",
          rights_confirmed: true,
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
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async updatePost() {
      throw new WordPressWriteError("network", "wp_network_error");
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
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 502);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "network");
  } finally {
    resetWordPressWriteClientFactoryForTest();
    __resetDbOverrideForTest();
  }
});

test("wp-publish: WP 4xx → 400 with kind=http_4xx", async () => {
  const db = makeStubDb([
    () => ({
      rows: [
        {
          id: "r1",
          status: "running",
          input: {},
          output: {},
          idempotency_key: "k1",
        },
      ],
      rowCount: 1,
    }),
    () => ({ rows: [{ editorial_item_id: "i1" }], rowCount: 1 }),
    () => ({
      rows: [
        {
          id: "i1",
          source_id: "src-1",
          wp_post_id: 1,
          stage: "approved",
          rights_confirmed: true,
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
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async updatePost() {
      throw new WordPressWriteError("http_4xx", "wp_http_400", 400);
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
        { run_id: "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7", wp_post_id: 1 },
        { "x-automation-secret": OK_SECRET },
      ),
    );
    assert.equal(r.status, 400);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "http_4xx");
  } finally {
    resetWordPressWriteClientFactoryForTest();
    __resetDbOverrideForTest();
  }
});

// Reference the unused import so the linter is happy.
void WordPressWriteClient;
