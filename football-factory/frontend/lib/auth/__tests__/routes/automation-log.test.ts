import { __resetRateLimiterForTest } from "@/lib/security/rate-limit";
import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { POST } from "@/app/api/automation/log/route";
import {
  __resetDbOverrideForTest,
  __setDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";

const OK_SECRET = "x".repeat(64);
const RUN_ID = "33333333-3333-4333-8333-333333333333";
const EDITORIAL_ID = "44444444-4444-4444-8444-444444444444";
const WORKFLOW_DIR = resolve(process.cwd(), "../automation/n8n/workflows");
const workflowNames = [
  "FF90-01-source-intake",
  "FF90-02-editorial-factory",
  "FF90-03-image-factory",
  "FF90-04-wordpress-draft",
  "FF90-05-human-review",
];
const input = {
  run_id: RUN_ID,
  editorial_item_id: EDITORIAL_ID,
  source_id: "src:18bc390df73db5432861958731dfa8d85274d64b6257ffcf",
  source_type: "test",
  news_type: "RESULT",
  provider_status: "NOT_CONFIGURED",
  visual_relevance: "NOT_CONFIGURED",
};
const outputs: Record<string, Record<string, unknown>> = {
  "POST /api/automation/deduplicate": { run_id: RUN_ID },
  "POST /api/automation/editorial-item": { run_id: RUN_ID, editorial_item_id: EDITORIAL_ID },
  "POST /api/automation/ai-assist": { title: "Synthetic", content: "Synthetic", slug: "synthetic", excerpt: "Synthetic" },
  "POST /api/automation/seo-check": { seo_check_status: "clear" },
  "POST /api/automation/fact-check": { fact_check_state: "cleared", provider_status: "NOT_CONFIGURED" },
  "POST /api/automation/wp-draft": { wp_post_id: 123, idempotent: false },
};

const savedEnv = {
  AUTOMATION_SECRET: process.env.AUTOMATION_SECRET,
  AUTOMATION_ENABLED: process.env.AUTOMATION_ENABLED,
  DATABASE_URL: process.env.DATABASE_URL,
};
let dbCalls: Array<{ sql: string; values: unknown[] }>;
let nextId: number;

function restoreEnv(name: keyof typeof savedEnv) {
  const value = savedEnv[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function makeRequest(body: unknown): Request {
  return new Request("https://ff90.test/api/automation/log", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-automation-secret": OK_SECRET,
    },
    body: JSON.stringify(body),
  });
}

function makeDb(): Db {
  dbCalls = [];
  nextId = 1000;
  return {
    configured: true,
    async query<T = Record<string, unknown>>(sql: string, values: unknown[] = []) {
      dbCalls.push({ sql, values });
      return { rows: [{ id: nextId++ }] as T[], rowCount: 1 };
    },
    async end() {},
  };
}

function evaluateKeypair(node: { name: string; parameters: Record<string, any> }): Record<string, unknown> {
  assert.equal(node.parameters.specifyBody, "keypair", node.name);
  const result: Record<string, unknown> = {};
  for (const field of node.parameters.bodyParameters.parameters as Array<{ name: string; value: unknown }>) {
    const value = field.value;
    if (typeof value === "string" && value.startsWith("={{") && value.endsWith("}}")) {
      const expression = value.slice(3, -2);
      result[field.name] = runInNewContext(`(${expression})`, {
        $json: structuredClone(input),
        $: (name: string) => ({ item: { json: structuredClone(outputs[name] ?? {}) } }),
        Date,
      }, { timeout: 1000 });
    } else {
      result[field.name] = value;
    }
  }
  return result;
}

function getAuditNodes() {
  const nodes: Array<{ workflow: string; node: any }> = [];
  for (const workflowName of workflowNames) {
    const file = resolve(WORKFLOW_DIR, `${workflowName}.json`);
    const workflow = JSON.parse(readFileSync(file, "utf8"));
    for (const node of workflow.nodes) {
      if (node.type === "n8n-nodes-base.httpRequest" && String(node.parameters.url).includes("/api/automation/log")) {
        nodes.push({ workflow: workflowName, node });
      }
    }
  }
  return nodes;
}

beforeEach(() => {
  __resetRateLimiterForTest();
  process.env.AUTOMATION_SECRET = OK_SECRET;
  // This is a process-local test fixture so the real route reaches validation.
  process.env.AUTOMATION_ENABLED = "true";
  process.env.DATABASE_URL = "postgres://automation-log-test";
  __setDbOverrideForTest(makeDb());
});

afterEach(() => {
  __resetDbOverrideForTest();
  __resetRateLimiterForTest();
  restoreEnv("AUTOMATION_SECRET");
  restoreEnv("AUTOMATION_ENABLED");
  restoreEnv("DATABASE_URL");
});

test("FF90-01 Audit log payload passes the actual automation log route contract", async () => {
  const { node } = getAuditNodes().find(({ workflow }) => workflow === "FF90-01-source-intake")!;
  const payload = evaluateKeypair(node);
  const response = await POST(makeRequest(payload));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, id: 1000 });
  assert.equal(dbCalls.length, 1);
  assert.match(dbCalls[0].sql, /INSERT INTO audit_logs/);
  assert.equal(dbCalls[0].values[0], "ff90_01_source_intake_complete");
  assert.equal(dbCalls[0].values[1], RUN_ID);
  const stored = JSON.parse(String(dbCalls[0].values[4]));
  assert.equal(stored.metadata.editorial_item_id, EDITORIAL_ID);
  assert.equal(stored.metadata.source_id, input.source_id);
});

test("all FF90-01..05 audit log nodes pass the actual automation log route contract", async () => {
  const nodes = getAuditNodes();
  assert.equal(nodes.length, 6);
  for (const { workflow, node } of nodes) {
    assert.equal(node.credentials?.httpHeaderAuth?.name, "FF90 Automation Secret", `${workflow}:${node.name}`);
    const response = await POST(makeRequest(evaluateKeypair(node)));
    assert.equal(response.status, 200, `${workflow}:${node.name}`);
  }
  assert.equal(dbCalls.length, 6);
});

test("automation log route rejects missing required fields with validation_failed", async () => {
  const response = await POST(makeRequest({ stage: "source_intake", status: "success" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "validation_failed" });
  assert.equal(dbCalls.length, 0);
});

test("automation log route rejects the former action field as a missing event_type", async () => {
  const response = await POST(makeRequest({
    run_id: RUN_ID,
    action: "ff90_01_source_intake_complete",
    stage: "source_intake",
    status: "success",
    metadata: { source_id: input.source_id, editorial_item_id: EDITORIAL_ID },
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "validation_failed" });
  assert.equal(dbCalls.length, 0);
});

test("automation log route rejects an unsupported status enum with validation_failed", async () => {
  const response = await POST(makeRequest({
    event_type: "ff90_01_source_intake_complete",
    stage: "source_intake",
    status: "unsupported_status",
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "validation_failed" });
  assert.equal(dbCalls.length, 0);
});

test("automation log route rejects a wrong field type with validation_failed", async () => {
  const response = await POST(makeRequest({
    event_type: "ff90_01_source_intake_complete",
    stage: "source_intake",
    status: 17,
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "validation_failed" });
  assert.equal(dbCalls.length, 0);
});
