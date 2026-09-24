import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("held editorial detail provides real-news source, content, status and draft UI", () => {
  const page = read("app/(admin)/admin/editorial/[id]/page.tsx");
  const component = read("components/admin/editorial-completion.tsx");
  assert.match(page, /AdminEditorialCompletion item=\{item\} run=\{run\}/);
  assert.match(component, /title_th/);
  assert.match(component, /body_th/);
  assert.match(component, /excerpt_th/);
  assert.match(component, /news_type/);
  assert.match(component, /source_url/);
  assert.match(component, /source_title/);
  assert.match(component, /publisher/);
  assert.match(component, /completion-run-status/);
  assert.match(component, /completion-wp-post-id/);
  assert.match(component, /target="_blank" rel="noopener noreferrer"/);
  assert.match(component, /Save editorial content/);
  assert.match(component, /Save and request same-run resume/);
  assert.match(component, /api\/admin\/editorial\/\$\{item\.id\}\/content/);
  assert.match(component, /api\/admin\/automation\/runs\/\$\{run\.id\}\/recover/);
  assert.match(component, /\/recover\/dispatch/);
  assert.doesNotMatch(component, /wp-publish|approval\/route/);
});

test("held items cannot use the legacy direct WP-draft shortcut", () => {
  const page = read("app/(admin)/admin/editorial/[id]/page.tsx");
  const route = read("app/api/admin/editorial/[id]/wp-draft/route.ts");
  assert.match(page, /run\?\.status === "held_for_content" \|\| run\?\.status === "recovery_queued"/);
  assert.match(route, /same_run_recovery_required/);
});

test("editorial queue exposes held real-news runs for operator completion", () => {
  const page = read("app/(admin)/admin/editorial/page.tsx");
  assert.match(page, /loadHeldRuns/);
  assert.match(page, /held_for_content/);
  assert.match(page, /Needs editorial content/);
  assert.match(page, /\/admin\/editorial\/\$\{run\.editorial_item_id\}/);
});

test("webhook token stays server-only and is never passed through the editorial UI", () => {
  const route = read("app/api/admin/automation/runs/[runId]/recover/dispatch/route.ts");
  const component = read("components/admin/editorial-completion.tsx");
  assert.match(route, /import "server-only"/);
  assert.match(route, /process\.env\.N8N_WEBHOOK_TOKEN/);
  assert.match(route, /X-FF90-Webhook-Token/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_N8N_WEBHOOK_TOKEN/);
  assert.doesNotMatch(component, /N8N_WEBHOOK_TOKEN|X-FF90-Webhook-Token/);
});
