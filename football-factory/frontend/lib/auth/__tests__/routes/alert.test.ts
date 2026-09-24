import { __resetRateLimiterForTest } from "@/lib/security/rate-limit";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/automation/alert/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";

const OK_SECRET = "x".repeat(64);
const RUN_ID = "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7";
process.env.AUTOMATION_SECRET = OK_SECRET;
process.env.AUTOMATION_ENABLED = "true";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?sslmode=require";

function withDb(fn: (calls: Array<{ sql: string; values: unknown[] }>) => Promise<void>) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    configured: true,
    calls,
    async query<T = Record<string, unknown>>(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      return { rows: [{ id: 41 }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  __setDbOverrideForTest(db as unknown as Db);
  return fn(calls).finally(() => __resetDbOverrideForTest());
}

function makeRequest(body: unknown) {
  return new Request("https://ff90.test/api/automation/alert", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-automation-secret": OK_SECRET,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => __resetRateLimiterForTest());

test("FF90-05 review-ready alert payload is accepted and persisted", async () => {
  await withDb(async (calls) => {
    const r = await POST(
      makeRequest({
        severity: "info",
        source: "ff90-05-human-review-gate",
        message: "FF90 NEWS READY FOR REVIEW",
        context: { review_status: "pending", pipeline_status: "waiting_human_review" },
        run_id: RUN_ID,
      }),
    );
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, id: 41 });
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO analytics_events/);
    const properties = JSON.parse(String(calls[0].values[1])) as Record<string, unknown>;
    assert.equal(properties.severity, "info");
    assert.equal(properties.message, "FF90 NEWS READY FOR REVIEW");
    assert.equal(properties.run_id, RUN_ID);
    assert.deepEqual(properties.context, { review_status: "pending", pipeline_status: "waiting_human_review" });
  });
});

test("alert route rejects an unsupported severity before database access", async () => {
  await withDb(async (calls) => {
    const r = await POST(
      makeRequest({ severity: "publish", source: "ff90", message: "invalid", run_id: RUN_ID }),
    );
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { ok: false, error: "validation_failed" });
    assert.equal(calls.length, 0);
  });
});
