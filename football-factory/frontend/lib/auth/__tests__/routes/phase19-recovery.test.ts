import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST as recover } from "@/app/api/admin/automation/runs/[runId]/recover/route";
import { POST as updateRunStatus } from "@/app/api/automation/run/status/route";
import { POST as claimRecovery } from "@/app/api/automation/recovery/claim/route";
import { __resetRateLimiterForTest } from "@/lib/security/rate-limit";
import {
  __resetTxOverrideForTest,
  __setTxOverrideForTest,
  type Db,
} from "@/lib/db/postgres";
import { createSessionToken } from "@/lib/auth/session";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const AUTH_SECRET = "phase19-test-auth-secret-32-chars";
const CONTENT = "เนื้อหาข่าวที่ผ่านการตรวจสอบโดยบรรณาธิการ ".repeat(12);

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.DATABASE_URL = "postgres://isolated-test";
  process.env.AUTOMATION_SECRET = "x".repeat(64);
  process.env.AUTOMATION_ENABLED = "true";
  __resetRateLimiterForTest();
});

afterEach(() => {
  __resetTxOverrideForTest();
  delete process.env.AUTH_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.AUTOMATION_SECRET;
  delete process.env.AUTOMATION_ENABLED;
});

function setTx(opts: { active?: boolean; draftOperation?: boolean; editorialContent?: boolean } = {}) {
  const statements: string[] = [];
  __setTxOverrideForTest(async (fn) => fn({
    async query<T = Record<string, unknown>>(sql: string) {
      statements.push(sql);
      if (/FROM automation_runs/i.test(sql)) return { rows: [{
        id: RUN_ID, workflow: "FF90-MASTER", status: "held_for_content", input: { source_url: "https://source.example/story" },
        output: {}, editorial_item_id: ITEM_ID, stage: "editorial_factory", error_class: null,
        updated_at: "2020-01-01T00:00:00Z", recovery_count: 0,
      }] as T[], rowCount: 1 };
      if (/FROM editorial_items/i.test(sql)) return { rows: [{
        id: ITEM_ID, source_id: "src:test", wp_post_id: null, stage: "editorial_created",
        approval_state: "pending", rights_confirmed: false,
        metadata: { ...(opts.editorialContent ? { title_th: "หัวข้อ", body_th: CONTENT } : {}) },
      }] as T[], rowCount: 1 };
      if (/FROM automation_run_recoveries/i.test(sql)) return { rows: opts.active ? [{ active: true }] as T[] : [], rowCount: opts.active ? 1 : 0 };
      if (/FROM wp_draft_operations/i.test(sql)) return { rows: opts.draftOperation ? [{ status: "uncertain", wp_post_id: null }] as T[] : [], rowCount: opts.draftOperation ? 1 : 0 };
      return { rows: [], rowCount: 1 };
    },
  } as Pick<Db, "query">));
  return statements;
}

function request(body: unknown, opts: { csrf?: string; cookie?: boolean } = {}) {
  const headers = new Headers({ "content-type": "application/json", "sec-fetch-site": opts.csrf ?? "same-origin" });
  if (opts.cookie !== false) {
    const token = createSessionToken({ userId: USER_ID, role: "admin", email: "admin@example.test" }, AUTH_SECRET);
    headers.set("cookie", `ff_session=${token}`);
  }
  return new Request("https://example.test/api/admin/automation/runs/" + RUN_ID + "/recover", {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ runId: RUN_ID }) };

test("Phase 19 recovery defaults to a read-only dry run for held content", async () => {
  const statements = setTx({ editorialContent: true });
  const response = await recover(request({ reason: "resume after editor completion" }), context);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.dry_run, true);
  assert.equal(body.recovery_allowed, true);
  assert.equal(body.resume_stage, "editorial_factory");
  assert.ok(statements.every((sql) => /^\s*SELECT\b/i.test(sql)), "dry run must not mutate state");
});

test("Phase 19 recovery refuses duplicate queues and uncertain WordPress drafts", async () => {
  const activeStatements = setTx({ editorialContent: true, active: true });
  const active = await recover(request({ reason: "retry", dry_run: false, editorial: { title_th: "หัวข้อ", body_th: CONTENT } }), context);
  assert.equal(active.status, 409);
  assert.equal((await active.json()).reason, "recovery_already_queued");
  assert.ok(activeStatements.every((sql) => /^\s*SELECT\b/i.test(sql)));

  const draftStatements = setTx({ editorialContent: true, draftOperation: true });
  const draft = await recover(request({ reason: "retry", dry_run: false, editorial: { title_th: "หัวข้อ", body_th: CONTENT } }), context);
  assert.equal(draft.status, 409);
  assert.match((await draft.json()).reason, /wp_draft_operation_uncertain/);
  assert.ok(draftStatements.every((sql) => /^\s*SELECT\b/i.test(sql)));
});

test("Phase 19 recovery rejects missing reason, cross-site requests, and anonymous callers", async () => {
  const noReason = await recover(request({ dry_run: true }), context);
  assert.equal(noReason.status, 400);
  const crossSite = await recover(request({ reason: "retry" }, { csrf: "cross-site" }), context);
  assert.equal(crossSite.status, 403);
  const anonymous = await recover(request({ reason: "retry" }, { cookie: false }), context);
  assert.equal(anonymous.status, 401);
});

test("Phase 19 status transition closes a claimed recovery and writes its audit atomically", async () => {
  const statements: string[] = [];
  __setTxOverrideForTest(async (fn) => fn({
    async query<T = Record<string, unknown>>(sql: string) {
      statements.push(sql);
      if (/SELECT status, editorial_item_id/i.test(sql)) return { rows: [{ status: "running", editorial_item_id: ITEM_ID }] as T[], rowCount: 1 };
      if (/UPDATE automation_runs/i.test(sql)) return { rows: [{ status: "held_for_content" }] as T[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  } as Pick<Db, "query">));
  const res = await updateRunStatus(new Request("https://example.test/api/automation/run/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-automation-secret": process.env.AUTOMATION_SECRET! },
    body: JSON.stringify({ run_id: RUN_ID, status: "held_for_content", stage: "editorial_factory", recovery_id: "44444444-4444-4444-8444-444444444444" }),
  }));
  assert.equal(res.status, 200);
  assert.ok(statements.some((sql) => /UPDATE automation_run_recoveries/.test(sql)));
  assert.ok(statements.some((sql) => /INSERT INTO audit_logs/.test(sql)));
});

test("Phase 19 automation status keeps the server-side kill switch fail-closed", async () => {
  process.env.AUTOMATION_ENABLED = "false";
  __setTxOverrideForTest(async () => { throw new Error("database must not be touched"); });
  const res = await updateRunStatus(new Request("https://example.test/api/automation/run/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-automation-secret": process.env.AUTOMATION_SECRET! },
    body: JSON.stringify({ run_id: RUN_ID, status: "held_for_content", stage: "editorial_factory" }),
  }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "automation_disabled");
});

test("Phase 19 recovery claim requires the automation secret and respects the kill switch", async () => {
  const url = "https://example.test/api/automation/recovery/claim";
  const body = JSON.stringify({ recovery_id: "44444444-4444-4444-8444-444444444444" });
  const noAuth = await claimRecovery(new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body }));
  assert.equal(noAuth.status, 401);
  process.env.AUTOMATION_ENABLED = "false";
  __setTxOverrideForTest(async () => { throw new Error("database must not be touched"); });
  const disabled = await claimRecovery(new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-automation-secret": process.env.AUTOMATION_SECRET! },
    body,
  }));
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).error, "automation_disabled");
});

test("concurrent duplicate claims serialize on the recovery row and only one can start a downstream chain", async () => {
  let recoveryStatus = "queued";
  let lockTail: Promise<void> = Promise.resolve();
  let successfulClaimUpdates = 0;
  const sqlSeen: string[] = [];
  __setTxOverrideForTest(async (fn) => {
    const prior = lockTail;
    let release!: () => void;
    lockTail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try {
      return await fn({
        async query<T = Record<string, unknown>>(sql: string) {
          sqlSeen.push(sql);
          if (/WHERE recovery\.id = \$1[\s\S]*FOR UPDATE OF recovery, run, item/i.test(sql)) {
            return { rows: [{
              id: "44444444-4444-4444-8444-444444444444", run_id: RUN_ID, editorial_item_id: ITEM_ID,
              recovery_status: recoveryStatus, available_at: new Date(Date.now() - 1000).toISOString(), claimed_at: null,
              attempt: 0, resume_stage: "editorial_factory", run_status: "recovery_queued", workflow: "FF90-MASTER",
              input: { source_url: "https://source.example/story" }, output: {}, run_stage: "editorial_factory",
              error_class: null, recovery_count: 1, source_id: "src:duplicate-test", wp_post_id: null,
              approval_state: "pending", editorial_stage: "editorial_created", metadata: { title_th: "หัวข้อ", body_th: CONTENT },
              draft_operation_status: null,
            }] as T[], rowCount: 1 };
          }
          if (/UPDATE automation_run_recoveries/i.test(sql)) {
            if (recoveryStatus !== "queued") return { rows: [] as T[], rowCount: 0 };
            recoveryStatus = "claimed";
            successfulClaimUpdates += 1;
            return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }] as T[], rowCount: 1 };
          }
          if (/UPDATE automation_runs/i.test(sql)) return { rows: [{ id: RUN_ID }] as T[], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        },
      });
    } finally { release(); }
  });

  const url = "https://example.test/api/automation/recovery/claim";
  const body = JSON.stringify({ recovery_id: "44444444-4444-4444-8444-444444444444" });
  const makeRequest = () => new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-automation-secret": process.env.AUTOMATION_SECRET! },
    body,
  });
  const responses = await Promise.all([claimRecovery(makeRequest()), claimRecovery(makeRequest())]);
  const results = await Promise.all(responses.map(async (response) => ({ status: response.status, body: await response.json() })));
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(results.filter((result) => result.status === 200 && result.body.ok === true).length, 1);
  assert.equal(successfulClaimUpdates, 1);
  assert.ok(sqlSeen.some((sql) => /FOR UPDATE OF recovery, run, item/.test(sql)));
  assert.ok(sqlSeen.some((sql) => /WHERE id = \$1 AND status = 'queued' AND available_at <= now\(\)/.test(sql)));
  // MASTER's recovery branch continues only for the single 2xx claim result;
  // the concurrent duplicate receives 409 and cannot start a second chain.
});
