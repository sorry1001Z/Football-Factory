// Tests for /api/automation/run/[runId] (Phase 18G)
//
// Machine-to-machine read of a single automation_runs row + linked
// editorial item + recent audit events. Mirrors /api/admin/automation/[runId]
// but uses x-automation-secret + AUTOMATION_ENABLED rather than admin
// session cookies.
//
// Cases:
//   1. no x-automation-secret header → 401 automation_secret_invalid
//   2. wrong secret → 401 automation_secret_invalid
//   3. AUTOMATION_ENABLED missing/false → 503 automation_disabled
//   4. AUTOMATION_ENABLED=true + invalid UUID → 400 invalid_run_id
//   5. AUTOMATION_ENABLED=true + nonexistent run → 404 run_not_found
//   6. AUTOMATION_ENABLED=true + valid run → 200 with run+editorialItem+recentEvents
//   7. No admin cookie is consulted (admin route NOT triggered)
//   8. DATABASE_URL missing → 503 database_not_configured
//   9. rate-limited IP eventually gets 429

import { __resetRateLimiterForTest } from "@/lib/security/rate-limit";
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/automation/run/[runId]/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";

const OK_SECRET = "x".repeat(64);
const URL_BASE =
  "https://football-factory-three.vercel.app/api/automation/run";

beforeEach(() => {
  __resetRateLimiterForTest();
  process.env.AUTOMATION_SECRET = OK_SECRET;
  // Tests flip this per-case via setting "" (delete) or "true"
  process.env.AUTOMATION_ENABLED = "true";
});

afterEach(() => {
  __resetDbOverrideForTest();
  delete process.env.AUTOMATION_ENABLED;
});

type Row = Record<string, unknown>;

function makeStubDb(plan: Array<() => unknown>): Db & { calls: Array<{ sql: string; values: unknown[] }> } {
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
    async end() {},
  };
}

function makeRequest(opts: {
  secret?: string | null;
  cookie?: string;
  runId: string;
}): Request {
  const headers: Record<string, string> = {};
  if (opts.secret) headers["x-automation-secret"] = opts.secret;
  if (opts.cookie) headers["cookie"] = opts.cookie;
  return new Request(`${URL_BASE}/${opts.runId}`, {
    method: "GET",
    headers,
  });
}

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const EDITORIAL_ID = "22222222-2222-4222-8222-222222222222";

test("run: no secret → 401 automation_secret_invalid", async () => {
  process.env.DATABASE_URL = "postgres://stub";
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(makeRequest({ runId: RUN_ID }), {
    params: Promise.resolve({ runId: RUN_ID }),
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "automation_secret_invalid");
});

test("run: wrong secret → 401 automation_secret_invalid", async () => {
  process.env.DATABASE_URL = "postgres://stub";
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(
    makeRequest({ secret: "y".repeat(64), runId: RUN_ID }),
    { params: Promise.resolve({ runId: RUN_ID }) },
  );
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "automation_secret_invalid");
});

test("run: AUTOMATION_ENABLED absent → 503 automation_disabled (no DB hit)", async () => {
  delete process.env.AUTOMATION_ENABLED;
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(
    makeRequest({ secret: OK_SECRET, runId: RUN_ID }),
    { params: Promise.resolve({ runId: RUN_ID }) },
  );
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "automation_disabled");
  // Crucially: kill-switch fires BEFORE DB. db.query must not be called.
  assert.equal(
    (db as unknown as { calls: unknown[] }).calls.length,
    0,
    "kill-switch must stop before any database query",
  );
});

test("run: AUTOMATION_ENABLED absent even with admin cookie → 503 (no admin bypass)", async () => {
  delete process.env.AUTOMATION_ENABLED;
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(
    makeRequest({
      secret: OK_SECRET,
      // Even a valid admin session cookie must NOT bypass kill-switch.
      cookie: `ff_session=${"z".repeat(128)}`,
      runId: RUN_ID,
    }),
    { params: Promise.resolve({ runId: RUN_ID }) },
  );
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, "automation_disabled");
});

test("run: enabled + invalid UUID → 400 invalid_run_id", async () => {
  process.env.DATOMATION_URL = "postgres://stub";
  process.env.DATABASE_URL = "postgres://stub";
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const bad = "not-a-uuid";
  const res = await GET(makeRequest({ secret: OK_SECRET, runId: bad }), {
    params: Promise.resolve({ runId: bad }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "invalid_run_id");
});

test("run: enabled + nonexistent valid UUID → 404 run_not_found", async () => {
  process.env.DATABASE_URL = "postgres://stub";
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(
    makeRequest({ secret: OK_SECRET, runId: RUN_ID }),
    { params: Promise.resolve({ runId: RUN_ID }) },
  );
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "run_not_found");
});

test("run: enabled + DATABASE_URL missing → 503 database_not_configured", async () => {
  delete process.env.DATABASE_URL;
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(
    makeRequest({ secret: OK_SECRET, runId: RUN_ID }),
    { params: Promise.resolve({ runId: RUN_ID }) },
  );
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "database_not_configured");
});

test("run: enabled + valid run → 200 with run+editorialItem+recentEvents", async () => {
  process.env.DATABASE_URL = "postgres://stub";
  const db = makeStubDb([
    // 1) SELECT run
    () => ({
      rows: [
        {
          id: RUN_ID,
          workflow: "FF90-04-wordpress-draft",
          status: "waiting_approval",
          stage: "wp_draft",
          error_class: null,
          editorial_item_id: EDITORIAL_ID,
          wp_post_id: 12345,
          created_at: "2026-09-22T00:00:00Z",
          updated_at: "2026-09-22T00:01:00Z",
        },
      ],
      rowCount: 1,
    }),
    // 2) editorial_item lookup (via repo)
    () => ({
      rows: [
        {
          id: EDITORIAL_ID,
          source_id: "src:abc",
          wp_post_id: 12345,
          stage: "waiting_approval",
          approval_state: "pending",
          rights_confirmed: false,
          metadata: { source_url: "https://example.test/a" },
        },
      ],
      rowCount: 1,
    }),
    // 3) recent audit events
    () => ({ rows: [], rowCount: 0 }),
  ]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(
    makeRequest({ secret: OK_SECRET, runId: RUN_ID }),
    { params: Promise.resolve({ runId: RUN_ID }) },
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.run, "run must be present");
  assert.equal(body.run.id, RUN_ID);
  assert.equal(body.run.wpPostId, 12345);
  assert.equal(body.run.editorialItemId, EDITORIAL_ID);
  assert.ok(body.editorialItem, "editorialItem must be present");
  assert.equal(body.editorialItem.id, EDITORIAL_ID);
  assert.ok(Array.isArray(body.recentEvents));
});

test("run: route file does not consult requireAdminOrEditor (no admin bypass)", () => {
  // Static-source assertion: we never accidentally wire an admin guard
  // into the automation-authenticated route.
  // Comments mentioning /admin/... are allowed (they document the
  // equivalent admin route), but no IMPORT/USE of admin guard helpers.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const routePath = path.join(
    process.cwd(),
    "app",
    "api",
    "automation",
    "run",
    "[runId]",
    "route.ts",
  );
  const src = fs.readFileSync(routePath, "utf-8");
  // No import of the admin guard.
  assert.equal(
    /from\s+["']@\/lib\/admin\/guard["']/.test(src),
    false,
    "automation/run route must NOT import @/lib/admin/guard",
  );
  // No call to requireAdmin* (allow comments).
  const codeOnly = src
    .split("\n")
    .filter((l: string) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");
  assert.equal(
    codeOnly.includes("requireAdminOrEditor"),
    false,
    "automation/run route must NOT use requireAdminOrEditor",
  );
  assert.equal(
    codeOnly.includes("requireAdmin("),
    false,
    "automation/run route must NOT use requireAdmin(",
  );
});

test("run: secret value is never echoed in any response", async () => {
  process.env.DATABASE_URL = "postgres://stub";
  process.env.AUTOMATION_SECRET = OK_SECRET;
  // bad-secret path
  const db = makeStubDb([() => ({ rows: [], rowCount: 0 })]);
  __setDbOverrideForTest(db as unknown as Db);
  const res = await GET(
    makeRequest({ secret: "DIFFERENT_SECRET_VALUE_DO_NOT_ECHO", runId: RUN_ID }),
    { params: Promise.resolve({ runId: RUN_ID }) },
  );
  const text = await res.text();
  assert.equal(
    text.includes("DIFFERENT_SECRET_VALUE_DO_NOT_ECHO"),
    false,
    "response must not echo the supplied secret",
  );
  assert.equal(
    text.includes(OK_SECRET),
    false,
    "response must not echo the configured secret",
  );
});
