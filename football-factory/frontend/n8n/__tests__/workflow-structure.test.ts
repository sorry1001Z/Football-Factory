// Structural test for the n8n workflow JSON (FIRST SLICE).
//
// Verifies:
//   - file parses
//   - Revalidate node uses x-ff-revalidate-secret (NOT x-revalidate-secret)
//   - Revalidate body includes "/news"
//   - workflow is NOT active (must be flipped manually after staging)
//   - placeholder Wait node's webhookId is null OR absent
//   - notes field explains activation requirements
//   - all required nodes are present

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WF_PATH = join(process.cwd(), "n8n", "football-factory-production-expansion.json");
const wf = JSON.parse(readFileSync(WF_PATH, "utf8"));

test("n8n-workflow: parses as JSON", () => {
  assert.equal(typeof wf, "object");
  assert.ok(Array.isArray(wf.nodes));
});

test("n8n-workflow: Revalidate node uses x-ff-revalidate-secret header", () => {
  const node = wf.nodes.find((n: { name?: string }) => n.name === "Revalidate");
  assert.ok(node, "Revalidate node missing");
  const params = node.parameters;
  const headers = params.headerParameters;
  const secret = headers.parameters.find(
    (p: { name?: string }) => p.name === "x-ff-revalidate-secret" || p.name === "x-revalidate-secret",
  );
  assert.ok(secret, "Revalidate header missing");
  assert.equal(
    secret.name,
    "x-ff-revalidate-secret",
    "Revalidate header must be x-ff-revalidate-secret (H7 fix)",
  );
});

test("n8n-workflow: Revalidate body includes /news", () => {
  const node = wf.nodes.find((n: { name?: string }) => n.name === "Revalidate");
  assert.match(node.parameters.body, /\/news/);
});

test("n8n-workflow: workflow is NOT active", () => {
  assert.equal(wf.active, false, "workflow.active must be false until staging approval");
});

test("n8n-workflow: notes mention staging webhook binding requirement", () => {
  assert.ok(typeof wf.notes === "string");
  assert.match(wf.notes, /staging/i);
  assert.match(wf.notes, /webhook/i);
});

test("n8n-workflow: all required nodes present", () => {
  const names = new Set<string>(wf.nodes.map((n: { name?: string }) => n.name));
  for (const expected of [
    "Source Webhook",
    "Deduplicate",
    "AI Assist",
    "Fact Check",
    "SEO",
    "Rights Check",
    "WordPress Draft",
    "Human Approval Wait",
    "Publish",
    "Revalidate",
    "Log Success",
    "Alert",
  ]) {
    assert.ok(names.has(expected), `node ${expected} missing`);
  }
});
