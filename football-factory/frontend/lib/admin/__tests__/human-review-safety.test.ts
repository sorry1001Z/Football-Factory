// Tests for the human rights-review + fact-review admin routes
// (HUMAN REVIEW + N8N PRE-ACTIVATION).

import test from "node:test";
import assert from "node:assert/strict";
import { POST as RightsReview } from "@/app/api/admin/editorial/[id]/rights-review/route";
import { POST as FactReview } from "@/app/api/admin/editorial/[id]/fact-review/route";
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

function makePostRequest(body: unknown, cookie: string | null, origin = "https://football-factory-three.vercel.app"): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin,
    "sec-fetch-site": "same-origin",
  };
  if (cookie) headers.cookie = cookie;
  return new Request(
    `${origin}/api/admin/editorial/${EDITORIAL_ID}/rights-review`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    },
  );
}

const ROUTE_CONTEXT = {
  params: Promise.resolve({ id: EDITORIAL_ID }),
} as unknown as { params: Promise<{ id: string }> };

function tokenFor(role: "admin" | "editor" | "member") {
  return createSessionToken(
    { userId: "u-test", role, email: `${role}@x.test` },
    process.env.AUTH_SECRET!,
    600,
  );
}

function baseRightsReviewEvidence() {
  return {
    source_url: "https://example.test/source",
    license_name: "CC-BY-4.0",
    attribution_text: "Source: example.test via CC-BY-4.0",
    commercial_use_confirmed: true,
    news_or_editorial_use_confirmed: true,
  };
}

function baseFactReviewEvidence() {
  return {
    claim_check_summary: "Verified against the official source listing.",
    claim_sources: ["https://example.test/source-1", "https://example.test/source-2"],
  };
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
    stage: "rights_check",
    approval_state: "pending",
    rights_confirmed: false,
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

// ----------------------------------------------------------------------
// RIGHTS REVIEW
// ----------------------------------------------------------------------

test("rights-review: anonymous -> 401 unauthenticated", async () => {
  await withDb([], async () => {
    const r = await RightsReview(
      makePostRequest({ decision: "cleared", evidence: baseRightsReviewEvidence() }, null),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 401);
  });
});

test("rights-review: member -> 403 forbidden", async () => {
  await withDb([], async () => {
    const cookie = `ff_session=${tokenFor("member")}`;
    const r = await RightsReview(
      makePostRequest({ decision: "cleared", evidence: baseRightsReviewEvidence() }, cookie),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 403);
  });
});

test("rights-review: editor cookie + cleared without evidence -> 400 validation_failed", async () => {
  await withDb([], async () => {
    const cookie = `ff_session=${tokenFor("editor")}`;
    const r = await RightsReview(
      makePostRequest({ decision: "cleared" }, cookie),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 400);
    const body = (await r.json()) as { error: string };
    assert.equal(body.error, "validation_failed");
  });
});

test("rights-review: editor + cleared WITH valid evidence -> 200 + rights_confirmed=true + audit logged", async () => {
  await withDb(
    [
      // findById
      () => ({
        rows: [editorialRow({ stage: "rights_check", rights_confirmed: false })],
        rowCount: 1,
      }),
      // UPDATE metadata.rights + rights_confirmed
      () => ({ rows: [], rowCount: 0 }),
      // audit_logs INSERT
      () => ({ rows: [{ id: 1001 }], rowCount: 1 }),
      // findById (re-read)
      () => ({
        rows: [
          editorialRow({
            stage: "rights_check",
            rights_confirmed: true,
            metadata: {
              rights: {
                state: "cleared",
                method: "human_review",
                reviewed_by: "u-test",
              },
            },
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await RightsReview(
        makePostRequest(
          { decision: "cleared", evidence: baseRightsReviewEvidence() },
          cookie,
        ),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        ok: boolean;
        decision: string;
        rights_confirmed: boolean;
        audit_logged: boolean;
      };
      assert.equal(body.ok, true);
      assert.equal(body.decision, "cleared");
      assert.equal(body.rights_confirmed, true);
      assert.equal(body.audit_logged, true);
    },
  );
});

test("rights-review: editor + rejected (no evidence required) -> rights_confirmed=false + stage=rejected", async () => {
  await withDb(
    [
      () => ({
        rows: [editorialRow({ stage: "rights_check", rights_confirmed: true })],
        rowCount: 1,
      }),
      // UPDATE
      () => ({ rows: [], rowCount: 0 }),
      // setStage findById
      () => ({
        rows: [editorialRow({ stage: "rights_check", rights_confirmed: true })],
        rowCount: 1,
      }),
      // setStage UPDATE
      () => ({
        rows: [editorialRow({ stage: "rejected", rights_confirmed: false })],
        rowCount: 1,
      }),
      // audit_logs INSERT
      () => ({ rows: [{ id: 1002 }], rowCount: 1 }),
      // findById (re-read)
      () => ({
        rows: [editorialRow({ stage: "rejected", rights_confirmed: false })],
        rowCount: 1,
      }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await RightsReview(
        makePostRequest({ decision: "rejected", notes: "license is unclear" }, cookie),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        decision: string;
        rights_confirmed: boolean;
        stage: string;
      };
      assert.equal(body.decision, "rejected");
      assert.equal(body.rights_confirmed, false);
      assert.equal(body.stage, "rejected");
    },
  );
});

test("rights-review: editor + manual_review -> rights_confirmed=false (stage unchanged)", async () => {
  await withDb(
    [
      () => ({
        rows: [editorialRow({ stage: "rights_check", rights_confirmed: false })],
        rowCount: 1,
      }),
      // UPDATE
      () => ({ rows: [], rowCount: 0 }),
      // (no setStage for manual_review)
      // audit_logs INSERT
      () => ({ rows: [{ id: 1003 }], rowCount: 1 }),
      // findById re-read
      () => ({
        rows: [editorialRow({ stage: "rights_check", rights_confirmed: false })],
        rowCount: 1,
      }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await RightsReview(
        makePostRequest({ decision: "manual_review", notes: "needs legal review" }, cookie),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        decision: string;
        rights_confirmed: boolean;
        stage: string;
      };
      assert.equal(body.decision, "manual_review");
      assert.equal(body.rights_confirmed, false);
      assert.equal(body.stage, "rights_check"); // unchanged
    },
  );
});

test("rights-review: terminal-state published -> 409 terminal_state_no_mutation", async () => {
  await withDb(
    [
      () => ({
        rows: [
          editorialRow({
            stage: "published",
            approval_state: "approved",
            rights_confirmed: true,
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await RightsReview(
        makePostRequest(
          { decision: "cleared", evidence: baseRightsReviewEvidence() },
          cookie,
        ),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 409);
      const body = (await r.json()) as { error: string };
      assert.equal(body.error, "terminal_state_no_mutation");
    },
  );
});

test("rights-review: cross-site POST -> 403 csrf_rejected", async () => {
  await withDb([], async () => {
    const cookie = `ff_session=${tokenFor("admin")}`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      origin: "https://evil.test",
      "sec-fetch-site": "cross-site",
      cookie,
    };
    const r = await RightsReview(
      new Request(
        "https://football-factory-three.vercel.app/api/admin/editorial/" +
          EDITORIAL_ID +
          "/rights-review",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ decision: "cleared", evidence: baseRightsReviewEvidence() }),
        },
      ),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 403);
  });
});

// ----------------------------------------------------------------------
// FACT REVIEW
// ----------------------------------------------------------------------

test("fact-review: anonymous -> 401", async () => {
  await withDb([], async () => {
    const r = await FactReview(
      makePostRequest({ decision: "cleared", evidence: baseFactReviewEvidence() }, null),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 401);
  });
});

test("fact-review: editor + cleared without evidence -> 400", async () => {
  await withDb([], async () => {
    const cookie = `ff_session=${tokenFor("editor")}`;
    const r = await FactReview(
      makePostRequest({ decision: "cleared" }, cookie),
      ROUTE_CONTEXT,
    );
    assert.equal(r.status, 400);
  });
});

test("fact-review: editor + cleared with valid evidence -> 200 metadata.fact_check.state=cleared, fact_check_score STILL null", async () => {
  await withDb(
    [
      () => ({
        rows: [editorialRow({ stage: "fact_check" })],
        rowCount: 1,
      }),
      // UPDATE metadata.fact_check (fact_check_score NOT modified by this query)
      () => ({ rows: [], rowCount: 0 }),
      // audit_logs INSERT
      () => ({ rows: [{ id: 2001 }], rowCount: 1 }),
      // findById re-read
      () => ({
        rows: [
          editorialRow({
            stage: "fact_check",
            metadata: {
              fact_check: {
                state: "cleared",
                method: "human_review",
                reviewed_by: "u-test",
              },
            },
          }),
        ],
        rowCount: 1,
      }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await FactReview(
        makePostRequest(
          { decision: "cleared", evidence: baseFactReviewEvidence() },
          cookie,
        ),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        ok: boolean;
        decision: string;
        fact_check_score: number | null;
      };
      assert.equal(body.ok, true);
      assert.equal(body.decision, "cleared");
      // The review route MUST explicitly keep fact_check_score=null —
      // human review is treated as a decision, not a numeric fact-check.
      assert.equal(body.fact_check_score, null);
    },
  );
});

test("fact-review: editor + rejected (no evidence required) -> metadata.fact_check.state=rejected, stage=rejected", async () => {
  await withDb(
    [
      () => ({
        rows: [editorialRow({ stage: "fact_check" })],
        rowCount: 1,
      }),
      // UPDATE
      () => ({ rows: [], rowCount: 0 }),
      // setStage findById
      () => ({ rows: [editorialRow({ stage: "fact_check" })], rowCount: 1 }),
      // setStage UPDATE
      () => ({
        rows: [editorialRow({ stage: "rejected" })],
        rowCount: 1,
      }),
      // audit_logs
      () => ({ rows: [{ id: 2002 }], rowCount: 1 }),
      // re-read
      () => ({ rows: [editorialRow({ stage: "rejected" })], rowCount: 1 }),
    ],
    async () => {
      const cookie = `ff_session=${tokenFor("editor")}`;
      const r = await FactReview(
        makePostRequest({ decision: "rejected", notes: "claim is unfounded" }, cookie),
        ROUTE_CONTEXT,
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as {
        decision: string;
        stage: string;
        fact_check_score: number | null;
      };
      assert.equal(body.decision, "rejected");
      assert.equal(body.stage, "rejected");
      assert.equal(body.fact_check_score, null);
    },
  );
});

// ----------------------------------------------------------------------
// WORKFLOW CONTRACT — ensure the wired 5-pack workflow JSON has the new
// branching nodes and active=false.
// ----------------------------------------------------------------------

import { readFileSync } from "node:fs";
import path from "node:path";

const WPATH = "C:/Users/Win10_2004/Downloads/football-factory-external-5-packs-master.zip";

test("workflow contract: FF_HOOK_5 (Fact Check Hook) -> Fact Check State Switch -> log/wait", () => {
  // Simple file-peek test: read zip, parse the workflow JSON.
  // (We can't import the workflow JSON via TS easily, so do it inline.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  const out = execSync(
    `python -c "import zipfile,json;w=zipfile.ZipFile('${WPATH.replace(/\\/g, "/")}').read('03-n8n-automation-pack/n8n-pack/workflows/football-factory-staging.json');import sys;d=json.loads(w);sys.stdout.write(json.dumps({'active':d['active'],'fc':d['connections'].get('Fact Check Hook',{}).get('main',[]),'rc':d['connections'].get('Rights Check Hook',{}).get('main',[]),'fc_switch_next':d['connections'].get('Fact Check State Switch',{}).get('main',[]),'rc_switch_next':d['connections'].get('Rights Check State Switch',{}).get('main',[]),'ha_to':d['connections'].get('Human Approval Hook',{}).get('main',[]),'ha_switch_next':d['connections'].get('Approval State Switch',{}).get('main',[]),'wait_loop':d['connections'].get('Wait for Human Review',{}).get('main',[]) }))"`,
    { encoding: "utf-8" },
  );
  const wf = JSON.parse(out);
  assert.equal(wf.active, false, "workflow active should be false");
  // FC -> Switch
  assert.ok(wf.fc[0][0].node === "Fact Check State Switch");
  // Switch output 0 (cleared) -> Rights Check Hook; 1 (pending_manual) -> Wait
  assert.equal(wf.fc_switch_next[0][0].node, "Rights Check Hook");
  assert.equal(wf.fc_switch_next[1][0].node, "Wait for Human Review");
  assert.equal(wf.fc_switch_next[2][0].node, "Log Hook"); // rejected/flagged -> halt+log
  // RC -> Switch
  assert.ok(wf.rc[0][0].node === "Rights Check State Switch");
  // Wait loops back to Fact Check Hook
  assert.equal(wf.wait_loop[0][0].node, "Fact Check Hook");
  // Approval: HA -> Approval State Switch
  assert.equal(wf.ha_to[0][0].node, "Approval State Switch");
  // Approval switch: approved -> Publish; rejected -> Log; pending -> Wait
  assert.equal(wf.ha_switch_next[0][0].node, "Publish Hook");
  assert.equal(wf.ha_switch_next[1][0].node, "Log Hook");
  assert.equal(wf.ha_switch_next[2][0].node, "Wait for Editor Approval");
});
