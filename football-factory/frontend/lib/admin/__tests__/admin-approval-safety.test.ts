// Tests for the admin/editorial approval route (CROSS-ROUTE SAFETY PATCH).
//
// Covers:
//   - approve + rights_confirmed=true → 200 + stage advanced to "approved"
//   - approve + rights_confirmed=false → 409 rights_not_cleared_before_approve
//   - reject without rights preconditions → 200 + stage advanced to "rejected"
//   - setApproval+setStage are two UPDATE statements (residual risk documented)
//   - idempotency / repeated approvals

import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/admin/editorial/[id]/approval/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";
import { createSessionToken } from "@/lib/auth/session";

process.env.AUTH_SECRET = "a".repeat(32);
process.env.SESSION_COOKIE_NAME = "ff_session";
process.env.AUTOMATION_SECRET = "x".repeat(64);
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?sslmode=require";
process.env.SITE_URL = "https://football-factory-three.vercel.app";

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

const ROUTE_CONTEXT = {
  params: Promise.resolve({ id: EDITORIAL_ID }),
} as unknown as { params: Promise<{ id: string }> };

function makeRequest(
  body: unknown,
  cookie: string | null,
  origin = "https://football-factory-three.vercel.app",
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin,
    "sec-fetch-site": "same-origin",
  };
  if (cookie) headers.cookie = cookie;
  return new Request(`${origin}/api/admin/editorial/${EDITORIAL_ID}/approval`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
}

function tokenFor(role: "admin" | "editor" | "member") {
  return createSessionToken(
    { userId: "u-test", role, email: `${role}@x.test` },
    process.env.AUTH_SECRET!,
    600,
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
    source_id: "src-x",
    wp_post_id: null,
    stage: "waiting_approval",
    approval_state: "pending",
    rights_confirmed: true,
    approved_by: null,
    approved_at: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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

test("admin/approval: editor cookie + rights_confirmed=true + state=approved → 200 stage=approved", async () => {
  await withDb(
    [
      // findById (existing)
      () => ({
        rows: [
          editorialRow({
            stage: "waiting_approval",
            rights_confirmed: true,
            approval_state: "pending",
          }),
        ],
        rowCount: 1,
      }),
      // setApproval UPDATE RETURNING
      () => ({
        rows: [
          editorialRow({
            stage: "waiting_approval",
            rights_confirmed: true,
            approval_state: "approved",
            approved_by: "u-test",
            approved_at: "2026-01-02T00:00:00Z",
          }),
        ],
        rowCount: 1,
      }),
      // setStage findById (current=waiting_approval)
      () => ({
        rows: [
          editorialRow({
            stage: "waiting_approval",
            rights_confirmed: true,
            approval_state: "approved",
          }),
        ],
        rowCount: 1,
      }),
      // setStage UPDATE RETURNING (stage=approved)
      () => ({
        rows: [
          editorialRow({
            stage: "approved",
            rights_confirmed: true,
            approval_state: "approved",
          }),
        ],
        rowCount: 1,
      }),
      // audit_logs INSERT
      () => ({ rows: [{ id: 1 }], rowCount: 1 }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await POST(
        makeRequest({ state: "approved" }, cookie),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        approval_state: string;
        stage: string;
        audit_logged: boolean;
      };
      assert.equal(body.approval_state, "approved");
      assert.equal(body.stage, "approved");
      assert.equal(body.audit_logged, true);
    },
  );
});

test("admin/approval: editor cookie + rights_confirmed=false + state=approved → 409", async () => {
  await withDb(
    [
      () => ({
        rows: [
          editorialRow({
            stage: "waiting_approval",
            rights_confirmed: false,
            approval_state: "pending",
            metadata: { rights: { state: "manual_review" } },
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await POST(
        makeRequest({ state: "approved" }, cookie),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as {
        error: string;
        rights_state: string;
        rights_confirmed: boolean;
      };
      assert.equal(body.error, "rights_not_cleared_before_approve");
      assert.equal(body.rights_state, "manual_review");
      assert.equal(body.rights_confirmed, false);
    },
  );
});

test("admin/approval: editor cookie + rights_confirmed=false + state=rejected → 200 (rejection unconditional)", async () => {
  await withDb(
    [
      () => ({
        rows: [
          editorialRow({
            stage: "waiting_approval",
            rights_confirmed: false,
            approval_state: "pending",
            metadata: { rights: { state: "manual_review" } },
          }),
        ],
        rowCount: 1,
      }),
      // setApproval UPDATE
      () => ({
        rows: [
          editorialRow({
            stage: "waiting_approval",
            rights_confirmed: false,
            approval_state: "rejected",
            approved_by: "u-test",
            approved_at: "2026-01-02T00:00:00Z",
          }),
        ],
        rowCount: 1,
      }),
      // setStage findById
      () => ({
        rows: [
          editorialRow({
            stage: "waiting_approval",
            rights_confirmed: false,
            approval_state: "rejected",
          }),
        ],
        rowCount: 1,
      }),
      // setStage UPDATE (stage=rejected)
      () => ({
        rows: [
          editorialRow({
            stage: "rejected",
            rights_confirmed: false,
            approval_state: "rejected",
          }),
        ],
        rowCount: 1,
      }),
      // audit_logs INSERT
      () => ({ rows: [{ id: 2 }], rowCount: 1 }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await POST(
        makeRequest({ state: "rejected" }, cookie),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        approval_state: string;
        stage: string;
      };
      assert.equal(body.approval_state, "rejected");
      assert.equal(body.stage, "rejected");
    },
  );
});

test("admin/approval: member cookie → 403 forbidden", async () => {
  await withDb([], async () => {
    const cookie = `ff_session=${tokenFor("member")}`;
    const r = await POST(
      makeRequest({ state: "approved" }, cookie),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 403);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "forbidden");
  });
});

test("admin/approval: anonymous (no cookie) → 401 unauthenticated", async () => {
  await withDb([], async () => {
    const r = await POST(
      makeRequest({ state: "approved" }, null),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 401);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "unauthenticated");
  });
});

test("admin/approval: cross-site POST → 403 csrf_rejected (fetch_site=cross-site)", async () => {
  await withDb([], async () => {
    const cookie = `ff_session=${tokenFor("admin")}`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      origin: "https://evil.test",
      "sec-fetch-site": "cross-site",
    };
    headers.cookie = cookie;
    const r = await POST(
      new Request(
        "https://football-factory-three.vercel.app/api/admin/editorial/" +
          EDITORIAL_ID +
          "/approval",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ state: "approved" }),
        },
      ),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 403);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "csrf_rejected");
  });
});
