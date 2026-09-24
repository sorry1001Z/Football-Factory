import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PATCH as saveEditorialContent } from "@/app/api/admin/editorial/[id]/content/route";
import { POST as dispatchRecovery } from "@/app/api/admin/automation/runs/[runId]/recover/dispatch/route";
import { POST as recoverRun } from "@/app/api/admin/automation/runs/[runId]/recover/route";
import { __resetTxOverrideForTest, __setTxOverrideForTest, __setDbOverrideForTest, __resetDbOverrideForTest, type Db } from "@/lib/db/postgres";
import { createSessionToken } from "@/lib/auth/session";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const RECOVERY_ID = "44444444-4444-4444-8444-444444444444";
const AUTH_SECRET = "phase19-completion-test-secret-32-chars";
const ARTICLE = "ผู้สื่อข่าวรายงานข้อมูลการแข่งขันจากแหล่งข่าวที่ระบุไว้ โดยบทความนี้จัดทำจากหลักฐานต้นทางและผ่านการตรวจทานจากบรรณาธิการ " .repeat(3);

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.DATABASE_URL = "postgres://isolated-test";
  process.env.AUTOMATION_ENABLED = "true";
  process.env.N8N_WEBHOOK_URL = "https://n8n.example.test/webhook/master-id";
  process.env.AUTOMATION_SECRET = "unit-test-automation-secret-never-log-32chars";
});

afterEach(() => {
  __resetTxOverrideForTest();
  __resetDbOverrideForTest();
  delete process.env.AUTH_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.AUTOMATION_ENABLED;
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.AUTOMATION_SECRET;
});

function headers(auth = true, role: "admin" | "editor" | "member" = "admin") {
  const result = new Headers({ "content-type": "application/json", "sec-fetch-site": "same-origin" });
  if (auth) {
    const token = createSessionToken({ userId: USER_ID, role, email: "operator@example.test" }, AUTH_SECRET);
    result.set("cookie", `ff_session=${token}`);
  }
  return result;
}

function contentBody(overrides: Record<string, unknown> = {}) {
  return {
    title_th: "หัวข้อข่าวจริง",
    body_th: ARTICLE,
    excerpt_th: "สรุปข่าวจากต้นทางที่ระบุ",
    slug: "real-news-story",
    news_type: "RESULT",
    source_url: "https://publisher.example/news/123",
    source_title: "Original source headline",
    publisher: "Verified Publisher",
    author: "Reporter",
    ...overrides,
  };
}

function setContentTx(opts: { runStatus?: string; draft?: boolean } = {}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  __setTxOverrideForTest(async (fn) => fn({
    async query<T = Record<string, unknown>>(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (/FROM editorial_items/i.test(sql)) return { rows: [{ id: ITEM_ID, source_id: "src:real-news", wp_post_id: null, metadata: { source_text: "Original source text", source_url: "https://publisher.example/news/123" } }] as T[], rowCount: 1 };
      if (/FROM automation_runs/i.test(sql)) return { rows: [{ id: RUN_ID, status: opts.runStatus ?? "held_for_content", output: {} }] as T[], rowCount: 1 };
      if (/FROM wp_draft_operations/i.test(sql)) return { rows: opts.draft ? [{ status: "created" }] as T[] : [], rowCount: opts.draft ? 1 : 0 };
      return { rows: [], rowCount: 1 };
    },
  } as Pick<Db, "query">));
  return calls;
}

test("real-news intake without test_content remains held and accepts no public completion writes", async () => {
  const calls = setContentTx();
  const noCookie = await saveEditorialContent(new Request(`https://example.test/api/admin/editorial/${ITEM_ID}/content`, {
    method: "PATCH", headers: headers(false), body: JSON.stringify(contentBody()),
  }), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(noCookie.status, 401);
  assert.equal(calls.length, 0);

  const member = await saveEditorialContent(new Request(`https://example.test/api/admin/editorial/${ITEM_ID}/content`, {
    method: "PATCH", headers: headers(true, "member"), body: JSON.stringify(contentBody()),
  }), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(member.status, 403);
  assert.equal(calls.length, 0);

  const shortContent = await saveEditorialContent(new Request(`https://example.test/api/admin/editorial/${ITEM_ID}/content`, {
    method: "PATCH", headers: headers(), body: JSON.stringify(contentBody({ body_th: "สั้น" })),
  }), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(shortContent.status, 400);
  assert.equal(calls.length, 0);
});

test("saved real-news content queues resume for the same run and editorial item", async () => {
  const statements: string[] = [];
  __setTxOverrideForTest(async (fn) => fn({
    async query<T = Record<string, unknown>>(sql: string) {
      statements.push(sql);
      if (/FROM automation_runs/i.test(sql)) return { rows: [{ id: RUN_ID, workflow: "FF90-MASTER", status: "held_for_content", input: { source_url: "https://publisher.example/news/123" }, output: {}, editorial_item_id: ITEM_ID, stage: "editorial_factory", error_class: null, updated_at: "2020-01-01T00:00:00Z", recovery_count: 0 }] as T[], rowCount: 1 };
      if (/FROM editorial_items/i.test(sql)) return { rows: [{ id: ITEM_ID, source_id: "src:real-news", wp_post_id: null, stage: "editorial_created", approval_state: "pending", rights_confirmed: false, metadata: { title_th: "หัวข้อข่าวจริง", body_th: ARTICLE, source_url: "https://publisher.example/news/123", publisher: "Verified Publisher" } }] as T[], rowCount: 1 };
      if (/FROM automation_run_recoveries/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/FROM wp_draft_operations/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO automation_run_recoveries/i.test(sql)) return { rows: [{ id: RECOVERY_ID, available_at: new Date().toISOString() }] as T[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  } as Pick<Db, "query">));
  const response = await recoverRun(new Request(`https://example.test/api/admin/automation/runs/${RUN_ID}/recover`, {
    method: "POST", headers: headers(), body: JSON.stringify({ reason: "operator completed real news", dry_run: false }),
  }), { params: Promise.resolve({ runId: RUN_ID }) });
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.recovery_id, RECOVERY_ID);
  assert.equal(result.resume_stage, "editorial_factory");
  assert.equal(result.launch_payload.recovery_id, RECOVERY_ID);
  assert.ok(statements.some((sql) => /UPDATE automation_runs[\s\S]*status = 'recovery_queued'/i.test(sql)));
  assert.ok(statements.some((sql) => /INSERT INTO audit_logs/.test(sql)));
  assert.equal(statements.some((sql) => /UPDATE editorial_items/.test(sql)), false, "resume uses already-saved editorial content");
});

test("authorized editorial completion saves human copy and provenance without changing source_id or run status", async () => {
  const calls = setContentTx();
  const response = await saveEditorialContent(new Request(`https://example.test/api/admin/editorial/${ITEM_ID}/content`, {
    method: "PATCH", headers: headers(), body: JSON.stringify(contentBody()),
  }), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.run_id, RUN_ID);
  assert.equal(result.editorial_item_id, ITEM_ID);
  assert.equal(result.source_id, "src:real-news");
  assert.equal(result.status, "held_for_content");
  assert.ok(calls.some(({ sql }) => /UPDATE editorial_items SET metadata/.test(sql)));
  assert.ok(calls.some(({ sql }) => /status = 'held_for_content'/.test(sql)), "only the linked held run may be completed");
  assert.ok(calls.some(({ sql }) => /editorial_content_completed/.test(sql)));
  assert.equal(calls.some(({ sql }) => /UPDATE automation_runs/.test(sql)), false);
  const update = calls.find(({ sql }) => /UPDATE editorial_items SET metadata/.test(sql));
  const saved = JSON.parse(String(update?.values?.[1]));
  assert.equal(saved.title_th, "หัวข้อข่าวจริง");
  assert.equal(saved.source_url, "https://publisher.example/news/123");
  assert.equal(saved.publisher, "Verified Publisher");
  assert.equal(saved.source_text, "Original source text");
  assert.equal(saved.source_id, undefined);
});

test("content completion refuses non-held runs and any existing draft operation", async () => {
  setContentTx({ runStatus: "running" });
  const running = await saveEditorialContent(new Request(`https://example.test/api/admin/editorial/${ITEM_ID}/content`, {
    method: "PATCH", headers: headers(), body: JSON.stringify(contentBody()),
  }), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(running.status, 409);

  setContentTx({ draft: true });
  const draft = await saveEditorialContent(new Request(`https://example.test/api/admin/editorial/${ITEM_ID}/content`, {
    method: "PATCH", headers: headers(), body: JSON.stringify(contentBody()),
  }), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(draft.status, 409);
  assert.equal((await draft.json()).error, "wordpress_draft_operation_exists");
});

test("dispatch requires the kill switch and uses the configured MASTER webhook only on operator action", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown; headers: Headers }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return new Response("accepted", { status: 200 });
  }) as typeof fetch;
  const calls: string[] = [];
  __setDbOverrideForTest({
    async query<T = Record<string, unknown>>(sql: string) {
      calls.push(sql);
      return { rows: /SELECT recovery\.id/i.test(sql) ? [{ id: RECOVERY_ID }] as T[] : [], rowCount: 1 };
    },
  } as Db);
  const url = `https://example.test/api/admin/automation/runs/${RUN_ID}/recover/dispatch`;
  const body = JSON.stringify({ recovery_id: RECOVERY_ID });
  const context = { params: Promise.resolve({ runId: RUN_ID }) };
  try {
    process.env.AUTOMATION_ENABLED = "false";
    const closed = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body }), context);
    assert.equal(closed.status, 503);
    assert.equal(requests.length, 0);
    assert.equal(calls.length, 0);

    process.env.AUTOMATION_ENABLED = "true";
    const opened = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body }), context);
    assert.equal(opened.status, 202);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, process.env.N8N_WEBHOOK_URL);
    assert.deepEqual(requests[0].body, { recovery_id: RECOVERY_ID });
    assert.equal(requests[0].headers.get("x-automation-secret"), process.env.AUTOMATION_SECRET);
    assert.equal(requests[0].headers.get("content-type"), "application/json");
    assert.doesNotMatch(JSON.stringify(await opened.clone().json()), /unit-test-automation-secret-never-log|AUTOMATION_SECRET/);
    assert.equal(calls.filter((sql) => /run_recovery_dispatch_/.test(sql)).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("dispatch rejects unauthenticated and cross-site operators before DB or n8n", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = (async () => { fetchCount += 1; return new Response("accepted"); }) as typeof fetch;
  __setDbOverrideForTest({ async query<T = Record<string, unknown>>(sql: string) { calls.push(sql); return { rows: [], rowCount: 0 } as never; } } as unknown as Db);
  const url = `https://example.test/api/admin/automation/runs/${RUN_ID}/recover/dispatch`;
  const body = JSON.stringify({ recovery_id: RECOVERY_ID });
  try {
    const anonymous = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(false), body }), { params: Promise.resolve({ runId: RUN_ID }) });
    assert.equal(anonymous.status, 401);
    const member = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(true, "member"), body }), { params: Promise.resolve({ runId: RUN_ID }) });
    assert.equal(member.status, 403);
    const crossSiteHeaders = headers(); crossSiteHeaders.set("sec-fetch-site", "cross-site");
    const crossSite = await dispatchRecovery(new Request(url, { method: "POST", headers: crossSiteHeaders, body }), { params: Promise.resolve({ runId: RUN_ID }) });
    assert.equal(crossSite.status, 403);
    assert.equal(calls.length, 0);
    assert.equal(fetchCount, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("dispatch fails closed for missing secret, malformed IDs, missing URL, or non-dispatchable recovery", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = (async () => { fetchCount += 1; return new Response("accepted"); }) as typeof fetch;
  __setDbOverrideForTest({ async query<T = Record<string, unknown>>(sql: string) { calls.push(sql); return { rows: [], rowCount: 0 } as never; } } as unknown as Db);
  const url = `https://example.test/api/admin/automation/runs/${RUN_ID}/recover/dispatch`;
  const context = { params: Promise.resolve({ runId: RUN_ID }) };
  try {
    delete process.env.AUTOMATION_SECRET;
    const noSecret = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: RECOVERY_ID }) }), context);
    assert.equal(noSecret.status, 503);
    assert.equal((await noSecret.json()).error, "automation_secret_not_configured");
    assert.equal(calls.length, 0);

    process.env.AUTOMATION_SECRET = "unit-test-automation-secret-never-log-32chars";
    const malformedRun = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: RECOVERY_ID }) }), { params: Promise.resolve({ runId: "bad" }) });
    assert.equal(malformedRun.status, 400);
    assert.equal(calls.length, 0);
    const invalidId = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: "nope" }) }), context);
    assert.equal(invalidId.status, 400);
    assert.equal(calls.length, 0);

    delete process.env.N8N_WEBHOOK_URL;
    const noUrl = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: RECOVERY_ID }) }), context);
    assert.equal(noUrl.status, 503);
    assert.equal(calls.length, 0);

    process.env.N8N_WEBHOOK_URL = "https://n8n.example.test/webhook/master-id";
    const wrongRun = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: RECOVERY_ID }) }), context);
    assert.equal(wrongRun.status, 409);
    assert.equal((await wrongRun.json()).error, "recovery_not_dispatchable");
    const notQueued = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: RECOVERY_ID }) }), context);
    assert.equal(notQueued.status, 409);
    const runNotQueued = await dispatchRecovery(new Request(url, { method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: RECOVERY_ID }) }), context);
    assert.equal(runNotQueued.status, 409);
    assert.equal(fetchCount, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("dispatch timeout and HTTP errors remain queued and do not expose the secret", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  __setDbOverrideForTest({
    async query<T = Record<string, unknown>>(sql: string) {
      calls.push(sql);
      return { rows: /SELECT recovery\.id/i.test(sql) ? [{ id: RECOVERY_ID }] as T[] : [], rowCount: 1 };
    },
  } as Db);
  try {
    for (const fail of [
      async () => { throw new DOMException("timeout", "TimeoutError"); },
      async () => new Response("upstream failure", { status: 503 }),
    ]) {
      globalThis.fetch = (async () => fail()) as typeof fetch;
      const response = await dispatchRecovery(new Request(`https://example.test/api/admin/automation/runs/${RUN_ID}/recover/dispatch`, {
        method: "POST", headers: headers(), body: JSON.stringify({ recovery_id: RECOVERY_ID }),
      }), { params: Promise.resolve({ runId: RUN_ID }) });
      assert.equal(response.status, 502);
      const body = await response.text();
      assert.match(body, /recovery_queued/);
      assert.doesNotMatch(body, /unit-test-automation-secret-never-log|AUTOMATION_SECRET/);
    }
    assert.ok(calls.some((sql) => /run_recovery_dispatch_failed/.test(sql)));
  } finally { globalThis.fetch = originalFetch; }
});
