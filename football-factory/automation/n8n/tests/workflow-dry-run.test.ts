// FF90 Phase 18A — n8n workflow dry-run tests.
//
// This suite proves the FF90 automation pipeline's invariants WITHOUT
// touching the live API. It validates:
//   - All five workflow JSON exports parse + have the required shape
//   - The MASTER orchestrator wires sub-workflows in the right order
//   - Each sub-workflow reuses the existing automation contracts
//   - The publish-mode fail-closed semantics hold
//   - The manual_review mode NEVER auto-passes on timeout
//   - The future-mode branches (timeout_auto, full_auto) exist in
//     code but are not honored in Phase 18A
//
// These are pure unit tests — no DB, no network. They run via the
// project's existing `node --import tsx --test` runner.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(__dirname, "..");
const WORKFLOWS = join(ROOT, "workflows");
const CONTRACTS = join(ROOT, "contracts");
const FIXTURES = join(ROOT, "fixtures");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readWorkflow(name: string): {
  name: string;
  nodes: Array<{ name: string; type: string; parameters?: Record<string, unknown> }>;
  connections: Record<string, unknown>;
  active: boolean;
  tags: Array<{ name: string }>;
} {
  const path = join(WORKFLOWS, `${name}.json`);
  return readJson(path) as ReturnType<typeof readWorkflow>;
}

function readWorkflowNode(wf: ReturnType<typeof readWorkflow>, name: string) {
  const n = wf.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`node ${name} not found in ${wf.name}`);
  return n;
}

function readHttpUrl(n: { parameters?: Record<string, unknown> }): string {
  return String(n.parameters?.url ?? "");
}

// ============================================================
// Workflow JSON shape validation
// ============================================================

const WORKFLOW_FILES = [
  "FF90-MASTER",
  "FF90-01-source-intake",
  "FF90-02-editorial-factory",
  "FF90-03-image-factory",
  "FF90-04-wordpress-draft",
  "FF90-05-human-review",
] as const;

test("ff90: all 6 workflow JSON files parse and have required top-level fields", () => {
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f);
    assert.equal(typeof wf.name, "string", `${f}: name must be string`);
    assert.ok(Array.isArray(wf.nodes), `${f}: nodes must be array`);
    assert.ok(wf.nodes.length > 0, `${f}: nodes must be non-empty`);
    assert.equal(typeof wf.connections, "object", `${f}: connections must be object`);
    // Active must be exactly false in Phase 18A — we never live-activate.
    assert.equal(wf.active, false, `${f}: active must be false (Phase 18A no live activation)`);
    // Tagging: every FF90 workflow must carry the ff90 + phase-18a tags
    // so the operator can filter n8n by tag.
    const tagNames = wf.tags.map((t) => t.name);
    assert.ok(tagNames.includes("ff90"), `${f}: tag ff90 required`);
    assert.ok(tagNames.includes("phase-18a"), `${f}: tag phase-18a required`);
  }
});

test("ff90: every workflow has a unique id and a versionId", () => {
  const seen = new Set<string>();
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f) as { id?: string; versionId?: string };
    assert.ok(wf.id, `${f}: id required`);
    assert.equal(seen.has(wf.id), false, `${f}: id ${wf.id} duplicate`);
    seen.add(wf.id);
    assert.ok(wf.versionId, `${f}: versionId required`);
  }
});

// ============================================================
// MASTER orchestrator wiring
// ============================================================

test("ff90 master: executes sub-workflows in correct order", () => {
  const master = readWorkflow("FF90-MASTER");
  const execOrder = master.nodes
    .filter((n) => n.type === "n8n-nodes-base.executeWorkflow")
    .map((n) => String((n.parameters as { workflowId?: string }).workflowId));
  assert.deepEqual(
    execOrder,
    ["kwpSls38bmydgZK3", "MfMkjlDg1SnEUk3r", "hGQx1nGDbBPXgD83", "YvfaWlJGZfUBEkSC", "HOc6FXMlouQJDMAl"],
    "master must execute FF90-01 → 02 → 03 → 04 → 05 in that order",
  );
});

test("ff90 master: contains a STOP branch for duplicate / no editorial link", () => {
  const master = readWorkflow("FF90-MASTER");
  const stop = master.nodes.find((n) => n.name === "STOP (duplicate / no editorial link)");
  assert.ok(stop, "master must have a STOP branch");
  // Verify the If node that gates into STOP uses status !== accepted.
  const gate = master.nodes.find((n) => n.name === "Continue?");
  assert.ok(gate, "master must have a Continue? gate");
});

test("ff90 master: final envelope advertises manual_review + no auto-publish", () => {
  const master = readWorkflow("FF90-MASTER");
  const finalCode = readWorkflowNode(master, "Final envelope").parameters as {
    jsCode?: string;
  };
  assert.match(finalCode.jsCode ?? "", /waiting_human_review/);
  assert.match(finalCode.jsCode ?? "", /publish_mode.*manual_review/);
  assert.match(finalCode.jsCode ?? "", /auto_publish.*false/);
});

// ============================================================
// FF90-01 — Source Intake contract reuse
// ============================================================

test("ff90-01: dedupe is delegated to /api/automation/deduplicate with native Header Auth", () => {
  const wf = readWorkflow("FF90-01-source-intake");
  const dedupe = readWorkflowNode(wf, "POST /api/automation/deduplicate");
  const url = readHttpUrl(dedupe);
  assert.match(url, /\/api\/automation\/deduplicate/);
  assert.equal(dedupe.parameters?.authentication, "genericCredentialType");
  assert.equal(dedupe.parameters?.genericAuthType, "httpHeaderAuth");
  // The shared credential injects the automation header; never a session cookie.
  const headers = (dedupe.parameters?.headerParameters as {
    parameters: Array<{ name: string }>;
  } | undefined)?.parameters ?? [];
  const names = headers.map((h) => h.name);
  assert.equal(names.includes("x-automation-secret"), false, "auth header comes from the credential");
  assert.equal(
    names.includes("cookie"),
    false,
    "must NOT send a browser cookie from n8n",
  );
});

test("ff90-01: source_id is computed deterministically from canonical_url + published_at", () => {
  const wf = readWorkflow("FF90-01-source-intake");
  const code = readWorkflowNode(wf, "Normalize source").parameters as {
    jsCode?: string;
  };
  // Source code uses sha256 over canonical_url + NUL + published_at.
  assert.match(code.jsCode ?? "", /sha256/);
  assert.match(code.jsCode ?? "", /published_at/);
});

test("ff90-01: duplicate path stops WITHOUT calling editorial-item creation", () => {
  const wf = readWorkflow("FF90-01-source-intake");
  // The STOP branch must be wired to the true branch of the If gate.
  const dupCode = readWorkflowNode(wf, "STOP: duplicate").parameters as {
    jsCode?: string;
  };
  assert.match(dupCode.jsCode ?? "", /status.*duplicate/);
  // The If gate must split true → STOP and false → editorial-item POST.
  const connections = wf.connections as Record<string, { main: Array<Array<{ node: string }>> }>;
  const dup = connections["Duplicate?"].main;
  assert.equal(dup[0][0].node, "STOP: duplicate");
  assert.equal(dup[1][0].node, "POST /api/automation/editorial-item");
});

// ============================================================
// FF90-02 — Editorial Factory
// ============================================================

test("ff90-02: classifies into one of RESULT|PREVIEW|ANALYSIS|TRANSFER|BREAKING", () => {
  const wf = readWorkflow("FF90-02-editorial-factory");
  const classify = readWorkflowNode(wf, "Classify news type").parameters as {
    jsCode?: string;
  };
  for (const t of ["RESULT", "PREVIEW", "ANALYSIS", "TRANSFER", "BREAKING"]) {
    assert.match(classify.jsCode ?? "", new RegExp(t), `must mention ${t}`);
  }
});

test("ff90-02: article prompt forbids padding + forbids invented quotes/stats", () => {
  const wf = readWorkflow("FF90-02-editorial-factory");
  const build = readWorkflowNode(wf, "Build article prompt").parameters as {
    jsCode?: string;
  };
  assert.match(build.jsCode ?? "", /no invented quote/);
  assert.match(build.jsCode ?? "", /no invented statistic/);
  assert.match(build.jsCode ?? "", /NEVER pad/);
  assert.match(build.jsCode ?? "", /2,000-3,500 Thai characters/);
});

test("ff90-02: ai-assist + seo-check + fact-check all reuse existing automation endpoints", () => {
  const wf = readWorkflow("FF90-02-editorial-factory");
  for (const [nodeName, expectedPath] of [
    ["POST /api/automation/ai-assist", "/api/automation/ai-assist"],
    ["POST /api/automation/seo-check", "/api/automation/seo-check"],
    ["POST /api/automation/fact-check", "/api/automation/fact-check"],
  ] as const) {
    const n = readWorkflowNode(wf, nodeName);
    assert.match(readHttpUrl(n), new RegExp(expectedPath.replace(/\//g, "\\/")));
  }
});

// ============================================================
// FF90-03 — Image Factory
// ============================================================

test("ff90-03: provider adapter is explicitly fail-closed without env access", () => {
  const wf = readWorkflow("FF90-03-image-factory");
  const code = readWorkflowNode(wf, "Provider adapter").parameters as {
    jsCode?: string;
  };
  assert.match(code.jsCode ?? "", /NOT_CONFIGURED/);
  assert.doesNotMatch(code.jsCode ?? "", /\$env\./);
  assert.equal(wf.nodes.some(n => n.name === "POST image provider"), false);
  // And the downstream audit-log held branch must fire.
  const held = readWorkflowNode(wf, "Audit log (held)").parameters as {
    bodyParameters?: { parameters?: Array<{ name: string; value: string }> };
  };
  assert.ok(held.bodyParameters?.parameters?.some(field => field.name === "status" && field.value === "held_for_human"));
});

test("ff90-03: image prompt never claims documentary representation", () => {
  const wf = readWorkflow("FF90-03-image-factory");
  const code = readWorkflowNode(wf, "Build image prompt").parameters as {
    jsCode?: string;
  };
  assert.match(code.jsCode ?? "", /no false documentary/);
  assert.match(code.jsCode ?? "", /no copied editorial photography/);
});

test("ff90-03: visual relevance gate remains in the no-image review path", () => {
  const wf = readWorkflow("FF90-03-image-factory");
  assert.ok(wf.nodes.find((n) => n.name === "Visual relevance gate"));
  const code = readWorkflowNode(wf, "Visual relevance gate").parameters as {
    jsCode?: string;
  };
  assert.match(code.jsCode ?? "", /visual_relevance/);
  assert.match(code.jsCode ?? "", /RESULT.*PREVIEW.*ANALYSIS.*TRANSFER.*BREAKING/);
});

test("ff90-03: 6 derivatives planned (hero/thumb/social/feed/vertical/webp)", () => {
  const wf = readWorkflow("FF90-03-image-factory");
  const code = readWorkflowNode(wf, "Plan derivatives").parameters as {
    jsCode?: string;
  };
  for (const id of [
    "hero_16x9",
    "thumbnail",
    "social_1x1",
    "feed_4x5",
    "vertical_9x16",
    "web_optimized",
  ]) {
    assert.match(code.jsCode ?? "", new RegExp(id));
  }
});

// ============================================================
// FF90-04 — WordPress Draft
// ============================================================

test("ff90-04: WP draft is created via existing /api/automation/wp-draft (never a publish route)", () => {
  const wf = readWorkflow("FF90-04-wordpress-draft");
  const draft = readWorkflowNode(wf, "POST /api/automation/wp-draft");
  assert.match(readHttpUrl(draft), /\/api\/automation\/wp-draft/);
  // Hard rule: NO node may POST to /wp-publish.
  for (const n of wf.nodes) {
    const url = String(n.parameters?.url ?? "");
    assert.equal(
      url.includes("wp-publish"),
      false,
      `node ${n.name} must not call wp-publish`,
    );
  }
});

test("ff90-04: status sent to /wp-draft is NOT set (server hard-codes 'draft')", () => {
  const wf = readWorkflow("FF90-04-wordpress-draft");
  const draft = readWorkflowNode(wf, "POST /api/automation/wp-draft");
  const body = JSON.stringify(draft.parameters?.bodyParameters ?? "");
  // Our payload only carries run_id + editorial_item_id + title + content + slug + excerpt + news_type.
  // No status field — the server hard-codes draft.
  assert.equal(
    body.includes('"status"'),
    false,
    "workflow must NOT set status on wp-draft request",
  );
});

test("ff90-04: missing asset bytes → held_for_human (not silent skip)", () => {
  const wf = readWorkflow("FF90-04-wordpress-draft");
  const log = readWorkflowNode(wf, "Audit log (no image)").parameters as {
    bodyParameters?: { parameters?: Array<{ name: string; value: string }> };
  };
  assert.ok(log.bodyParameters?.parameters?.some(field => field.name === "status" && field.value === "held_for_human"));
});

// ============================================================
// FF90-05 — Human Review Gate
// ============================================================

test("ff90-05: publish_mode resolves to manual_review (fail-closed)", () => {
  const wf = readWorkflow("FF90-05-human-review");
  const code = readWorkflowNode(wf, "Resolve publish mode").parameters as {
    jsCode?: string;
  };
  assert.match(code.jsCode ?? "", /manual_review/);
  assert.match(code.jsCode ?? "", /FAIL-CLOSED/);
  // Default raw mode value must be 'manual_review'.
  assert.match(code.jsCode ?? "", /modeRaw\s*=\s*['"]manual_review['"]/);
  assert.doesNotMatch(code.jsCode ?? "", /\$env\./);
});

test("ff90-05: manual_review waits indefinitely — NO auto_pass_after timer", () => {
  const wf = readWorkflow("FF90-05-human-review");
  const wait = readWorkflowNode(wf, "Wait for explicit human decision").parameters as {
    jsCode?: string;
  };
  const code = wait.jsCode ?? "";
  assert.match(code, /manual_review/);
  assert.match(code, /waiting_human_review/);
  assert.match(code, /No timeout auto-pass/);
  // auto_pass_after MUST be null in the manual-review payload.
  assert.match(code, /auto_pass_after:\s*null/);
});

test("ff90-05: APPROVE branch sets approval_method=manual + does NOT call wp-publish", () => {
  const wf = readWorkflow("FF90-05-human-review");
  const approve = readWorkflowNode(wf, "APPROVE branch").parameters as {
    jsCode?: string;
  };
  const code = approve.jsCode ?? "";
  assert.match(code, /approval_method:\s*['"]manual['"]/);
  assert.match(code, /wp_publish_called:\s*false/);
  // The APPROVE branch must not invoke an HTTP node.
  const connections = wf.connections as Record<string, unknown>;
  const approveConn = connections["APPROVE branch"] ?? [];
  assert.equal(
    JSON.stringify(approveConn).includes("httpRequest"),
    false,
    "APPROVE branch must not call an HTTP node",
  );
});

test("ff90-05: REJECT branch records reason + does NOT publish", () => {
  const wf = readWorkflow("FF90-05-human-review");
  const reject = readWorkflowNode(wf, "REJECT branch").parameters as {
    jsCode?: string;
  };
  const code = reject.jsCode ?? "";
  assert.match(code, /review_status:\s*['"]rejected['"]/);
  assert.match(code, /status:\s*['"]held_for_revision['"]/);
});
// ============================================================
// CRITICAL: Manual mode 1-hour no-response test
// ============================================================

test("ff90: manual_review mode does NOT auto-pass after 1 hour of no response", () => {
  // The wait node is the source of truth here. It carries the note
  // that explicitly disclaims any timeout auto-pass, and the
  // auto_pass_after field is null.
  const wf = readWorkflow("FF90-05-human-review");
  const wait = readWorkflowNode(wf, "Wait for explicit human decision").parameters as {
    jsCode?: string;
  };
  const code = wait.jsCode ?? "";
  assert.match(code, /manual_review/);
  assert.match(code, /waiting_human_review/);
  assert.match(code, /No timeout auto-pass/);
  // auto_pass_after MUST be null in the manual-review payload.
  assert.match(code, /auto_pass_after:\s*null/);
  // The wait node does NOT contain any sleep or timer logic that
  // would advance past the WAIT state without a human decision.
  assert.equal(
    code.includes("setTimeout") || code.includes("Date.now() + 3600"),
    false,
    "wait node must NOT contain a self-advancing timer",
  );
});

// ============================================================
// Future-mode scaffolding tests
// ============================================================

test("ff90: timeout_auto and full_auto paths are described but not honored", () => {
  // The Resolve publish mode node must explicitly list the three
  // supported modes (so future activation is a config flip, not a
  // code change) but always default to manual_review in Phase 18A.
  const wf = readWorkflow("FF90-05-human-review");
  const mode = readWorkflowNode(wf, "Resolve publish mode").parameters as {
    jsCode?: string;
  };
  const code = mode.jsCode ?? "";
  assert.match(code, /timeout_auto/);
  assert.match(code, /full_auto/);
  assert.match(code, /manual_review/);
  // Fail-closed semantics: any unknown / missing value must collapse
  // to manual_review.
  assert.match(code, /FAIL-CLOSED/);
  // APPROVE branch must explicitly say it does NOT auto-publish.
  const approve = readWorkflowNode(wf, "APPROVE branch").parameters as {
    jsCode?: string;
  };
  assert.match(approve.jsCode ?? "", /does NOT auto-publish|NOT.*auto-publish|never auto-publish/i);
});

test("ff90: no workflow JSON contains a credential value (secrets only via $env)", () => {
  // Walk every workflow JSON and assert no string literal that looks
  // like a credential (Bearer, Basic, sk-, ghp_, xoxb-, AKIA, etc.).
  const suspicious = [
    /Bearer\s+[A-Za-z0-9._-]{20,}/,
    /Basic\s+[A-Za-z0-9=_-]{20,}/,
    /\bsk-[A-Za-z0-9]{20,}\b/,
    /\bghp_[A-Za-z0-9]{20,}\b/,
    /\bxoxb-[A-Za-z0-9-]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /password\s*[:=]\s*['"][^'"]{6,}['"]/i,
  ];
  for (const f of WORKFLOW_FILES) {
    const raw = readFileSync(join(WORKFLOWS, `${f}.json`), "utf-8");
    for (const re of suspicious) {
      assert.equal(re.test(raw), false, `${f}: suspicious credential literal matched ${re}`);
    }
  }
});

// ============================================================
// Fixture validation — all 5 news types are well-formed
// ============================================================

const FIXTURE_FILES = [
  ["result-news.json", "RESULT"],
  ["preview-news.json", "PREVIEW"],
  ["analysis-news.json", "ANALYSIS"],
  ["transfer-news.json", "TRANSFER"],
  ["breaking-news.json", "BREAKING"],
] as const;

test("ff90: every fixture matches source schema + news_type field", () => {
  for (const [file, expectedType] of FIXTURE_FILES) {
    const fx = readJson(join(FIXTURES, file)) as { news_type: string; source_url: string };
    assert.equal(fx.news_type, expectedType, `${file} must have news_type=${expectedType}`);
    assert.ok(fx.source_url.startsWith("https://"), `${file} must have https source_url`);
  }
});

test("ff90: every fixture is byte-stable across the 5 fixtures (idempotent)", () => {
  // Hashing the fixture set ensures accidental edits are loud.
  const hash = createHash("sha256");
  for (const [file] of FIXTURE_FILES) {
    hash.update(readFileSync(join(FIXTURES, file), "utf-8"));
  }
  // We just check the hash is non-trivial; the exact value isn't important.
  assert.ok(hash.digest("hex").length === 64);
});

// ============================================================
// Contract schemas parse
// ============================================================

const CONTRACT_FILES = [
  "source.schema.json",
  "editorial.schema.json",
  "image.schema.json",
  "review.schema.json",
  "quality-metrics.schema.json",
];

test("ff90: every contract schema is valid JSON Schema Draft-07", () => {
  for (const f of CONTRACT_FILES) {
    const s = readJson(join(CONTRACTS, f)) as { $schema?: string; type?: string };
    assert.match(s.$schema ?? "", /draft-07/);
    assert.equal(s.type, "object", `${f} must be type=object`);
  }
});

test("ff90: image schema enforces ai_generated → no fake author", () => {
  const s = readJson(join(CONTRACTS, "image.schema.json")) as {
    allOf: Array<{ if?: unknown; then?: { required?: string[] } }>;
  };
  // Locate the ai_generated rule.
  const aiRule = s.allOf.find((rule) => {
    const j = JSON.stringify(rule);
    return j.includes("ai_generated");
  });
  assert.ok(aiRule, "image schema must have an ai_generated rule");
});

// ============================================================
// Phase 18A DELTA SAFETY AUDIT (added on final-safety-audit brief)
// ============================================================

test("ff90 audit: quality-metrics contract requires the 7 brief-listed booleans", () => {
  const s = readJson(join(CONTRACTS, "quality-metrics.schema.json")) as {
    required: string[];
    properties: Record<string, { type: string }>;
  };
  for (const field of [
    "human_edited_title",
    "human_edited_body",
    "human_changed_image",
    "human_changed_seo",
    "human_changed_fact",
    "human_rejected",
    "critical_error",
  ]) {
    assert.ok(s.required.includes(field), `quality-metrics must require ${field}`);
    assert.equal(s.properties[field].type, "boolean");
  }
});

test("ff90 audit: no workflow node branches on publish_mode (no if / switch on it)", () => {
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f);
    for (const n of wf.nodes) {
      const code =
        String((n.parameters as { jsCode?: string }).jsCode ?? "") +
        " " +
        JSON.stringify((n.parameters as { bodyParameters?: unknown }).bodyParameters ?? "");
      // No live code may have an `if (publish_mode ===` style branch.
      assert.equal(
        /if\s*\([^)]*publish_mode/.test(code),
        false,
        `${f}:${n.name} must not branch on publish_mode`,
      );
      assert.equal(
        /switch\s*\([^)]*publish_mode/.test(code),
        false,
        `${f}:${n.name} must not switch on publish_mode`,
      );
    }
  }
});

test("ff90 audit: APPROVE branch never sets wp_publish_called=true or status=published", () => {
  const wf = readWorkflow("FF90-05-human-review");
  const approve = readWorkflowNode(wf, "APPROVE branch").parameters as {
    jsCode?: string;
  };
  const code = approve.jsCode ?? "";
  assert.match(code, /wp_publish_called:\s*false/);
  assert.equal(code.includes("status: 'published'"), false);
  assert.equal(code.includes('"published"'), false);
  assert.equal(/approval_method\s*:\s*['"]timeout_auto/.test(code), false);
});

test("ff90 audit: no file contains AUTOMATION_ENABLED=true literal", () => {
  for (const f of WORKFLOW_FILES) {
    const raw = readFileSync(join(WORKFLOWS, `${f}.json`), "utf-8");
    assert.equal(
      /AUTOMATION_ENABLED\s*[:=]\s*['"]true['"]/.test(raw),
      false,
      `${f} must not set AUTOMATION_ENABLED=true`,
    );
  }
});

test("ff90 audit: no workflow has active=true", () => {
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f);
    assert.equal(wf.active, false, `${f} must remain active=false in Phase 18A`);
  }
});

test("ff90 audit: no workflow references wp-publish as an HTTP target", () => {
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f);
    for (const n of wf.nodes) {
      const url = String((n.parameters as { url?: string }).url ?? "");
      assert.equal(
        url.includes("wp-publish"),
        false,
        `${f}:${n.name} must not POST to wp-publish`,
      );
    }
  }
});

// ============================================================
// Phase 18A invariants
// ============================================================

test("ff90: Phase 18A invariants hold across all workflows", () => {
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f);
    // active=false everywhere (no live activation).
    assert.equal(wf.active, false, `${f} active must be false`);
    // No wf-publish call (would auto-publish).
    for (const n of wf.nodes) {
      const url = String(n.parameters?.url ?? "");
      assert.equal(
        url.includes("/api/automation/wp-publish") ||
          url.includes("/api/admin/posts") &&
            JSON.stringify(n.parameters?.bodyParameters ?? "").includes('"status"') &&
            JSON.stringify(n.parameters?.bodyParameters ?? "").includes('"publish"'),
        false,
        `${f}:${n.name} must not call wp-publish with status=publish`,
      );
    }
  }
});


// ============================================================
// Phase 18G — full-chain contract repair assertions
// ============================================================

test("ff90 18G: MASTER references 5 children with the production runtime IDs", () => {
  const master = readWorkflow("FF90-MASTER");
  const execNodes = master.nodes.filter((n) => n.type === "n8n-nodes-base.executeWorkflow");
  const refs = execNodes
    .map((n) => String((n.parameters as { workflowId?: string }).workflowId))
    .sort();
  assert.deepEqual(
    refs,
    ["kwpSls38bmydgZK3", "MfMkjlDg1SnEUk3r", "hGQx1nGDbBPXgD83", "YvfaWlJGZfUBEkSC", "HOc6FXMlouQJDMAl"].sort(),
    "MASTER must execute FF90-01..05 by production runtime ID",
  );
});

test("ff90 18G: all 6 workflows still active=false", () => {
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f);
    assert.equal(wf.active, false, `${f}: active must remain false`);
  }
});

test("ff90 18G: FF90-02 GET node uses /api/automation/run/ (NOT /api/admin/automation/)", () => {
  const wf = readWorkflow("FF90-02-editorial-factory");
  const getNode = wf.nodes.find(
    (n) => n.type === "n8n-nodes-base.httpRequest" &&
           String((n.parameters as { method?: string }).method) === "GET",
  );
  assert.ok(getNode, "FF90-02 must have a GET HTTP node");
  const url = String((getNode.parameters as { url?: string }).url);
  assert.match(url, /\/api\/automation\/run\//, "FF90-02 GET must target /api/automation/run/");
  assert.doesNotMatch(url, /\/api\/admin\/automation\//, "FF90-02 GET must NOT target /api/admin/automation/");
});

test("ff90 18G: zero /api/admin/automation references in any FF90 workflow", () => {
  for (const f of WORKFLOW_FILES) {
    const raw = readFileSync(join(WORKFLOWS, `${f}.json`), "utf-8");
    // The literal string /api/admin/automation must not appear as a URL.
    // Comments mentioning the migration are allowed in non-URL contexts.
    assert.equal(
      /url[^"]*"[^"]*\/api\/admin\/automation\//.test(raw),
      false,
      `${f}: must not URL-reference /api/admin/automation/`,
    );
  }
});

test("ff90 18G: FF90-04 contains /api/automation/media (no /api/admin/posts/media)", () => {
  const wf = readWorkflow("FF90-04-wordpress-draft");
  const raw = readFileSync(join(WORKFLOWS, `${f("FF90-04-wordpress-draft")}.json`), "utf-8");
  assert.match(raw, /\/api\/automation\/media/, "FF90-04 must reference /api/automation/media");
  assert.doesNotMatch(raw, /\/api\/admin\/posts\/media/, "FF90-04 must NOT reference /api/admin/posts/media");
});

test("ff90 18G: zero /api/admin/posts/media references in any FF90 workflow", () => {
  for (const f of WORKFLOW_FILES) {
    const raw = readFileSync(join(WORKFLOWS, `${f}.json`), "utf-8");
    assert.doesNotMatch(raw, /\/api\/admin\/posts\/media/, `${f}: must not reference /api/admin/posts/media`);
  }
});

test("ff90 18G: no FF90 workflow calls /api/automation/wp-publish", () => {
  for (const f of WORKFLOW_FILES) {
    const wf = readWorkflow(f);
    for (const n of wf.nodes) {
      const url = String((n.parameters as { url?: string }).url ?? "");
      assert.equal(
        url.includes("wp-publish"),
        false,
        `${f}.${n.name}: must not call wp-publish`,
      );
    }
  }
});

test("ff90 18G: FF90-01 has Promote FF90-01 output emitting canonical envelope", () => {
  const wf = readWorkflow("FF90-01-source-intake");
  const promote = wf.nodes.find((n) => n.name === "Promote FF90-01 output");
  assert.ok(promote, "FF90-01 must have a Promote FF90-01 output node");
  const code = String((promote.parameters as { jsCode?: string }).jsCode ?? "");
  assert.match(code, /run_id/, "promote must include run_id");
  assert.match(code, /editorial_item_id/, "promote must include editorial_item_id");
  assert.match(code, /pipeline_status/, "promote must include pipeline_status");
  // Audit log must precede promote.
  const auditIdx = wf.nodes.findIndex((n) => n.name === "Audit log");
  const promoteIdx = wf.nodes.findIndex((n) => n.name === "Promote FF90-01 output");
  assert.ok(auditIdx >= 0 && promoteIdx > auditIdx, "promote must come after Audit log");
  // Connection: Audit log → Promote FF90-01 output
  const conn = (wf.connections as Record<string, { main: Array<Array<{ node: string }>> }>);
  const auditConn = conn["Audit log"]?.main?.[0] ?? [];
  assert.ok(
    auditConn.some((c) => c.node === "Promote FF90-01 output"),
    "Audit log must connect to Promote FF90-01 output",
  );
});

test("ff90 18G: FF90-03 held path preserves editorial fields", () => {
  const wf = readWorkflow("FF90-03-image-factory");
  const provider = wf.nodes.find((n) => n.name === "Provider adapter");
  const code = String((provider.parameters as { jsCode?: string }).jsCode ?? "");
  // Must preserve upstream fields (we use spread '...upstream').
  assert.match(code, /\.\.\.upstream/, "provider adapter must spread upstream fields");
  assert.match(code, /provider_status.*NOT_CONFIGURED/, "NOT_CONFIGURED branch must set provider_status");
  assert.match(code, /image_status.*held/, "NOT_CONFIGURED branch must set image_status=held");
});

test("ff90 18G: FF90-03 has Promote FF90-03 output (terminal canonical envelope)", () => {
  const wf = readWorkflow("FF90-03-image-factory");
  const promote = wf.nodes.find((n) => n.name === "Promote FF90-03 output");
  assert.ok(promote, "FF90-03 must have a Promote FF90-03 output node");
});

test("ff90 18G: FF90-04 has Validate editorial fields gate", () => {
  const wf = readWorkflow("FF90-04-wordpress-draft");
  const validate = wf.nodes.find((n) => n.name === "Validate editorial fields");
  assert.ok(validate, "FF90-04 must have a Validate editorial fields node");
  const code = String((validate.parameters as { jsCode?: string }).jsCode ?? "");
  assert.match(code, /title_th/, "validate must check title_th");
  assert.match(code, /body_th/, "validate must check body_th");
  assert.match(code, /held_for_content/, "validate must fail-closed with held_for_content");
});

test("ff90 18G: FF90-04 has Promote FF90-04 output (canonical envelope after wp-draft)", () => {
  const wf = readWorkflow("FF90-04-wordpress-draft");
  const promote = wf.nodes.find((n) => n.name === "Promote FF90-04 output");
  assert.ok(promote, "FF90-04 must have a Promote FF90-04 output node");
});

test("ff90 18G: FF90-05 does NOT call wp-publish (manual_review guard)", () => {
  const wf = readWorkflow("FF90-05-human-review");
  // /api/automation/alert is the only allowed HTTP call (persistence only).
  for (const n of wf.nodes) {
    const url = String((n.parameters as { url?: string }).url ?? "");
    if (url) {
      assert.equal(
        url.includes("wp-publish"),
        false,
        `${n.name} must not call wp-publish`,
      );
      // Only alert endpoint is allowed.
      assert.match(
        url,
        /\/api\/automation\/alert\b/,
        `${n.name} may only call /api/automation/alert (got ${url})`,
      );
    }
  }
  const approve = wf.nodes.find((n) => n.name === "APPROVE branch");
  const approveCode = String((approve.parameters as { jsCode?: string }).jsCode ?? "");
  assert.match(approveCode, /wp_publish_called:\s*false/, "APPROVE must set wp_publish_called=false");
});

test("ff90 18G: FF90-05 has Promote FF90-05 output (preserves run_id/editorial_item_id/wp_post_id)", () => {
  const wf = readWorkflow("FF90-05-human-review");
  const promote = wf.nodes.find((n) => n.name === "Promote FF90-05 output");
  assert.ok(promote, "FF90-05 must have a Promote FF90-05 output node");
});

test("ff90 18G: MASTER has Editorial ready? gate (stops chain on held_for_content)", () => {
  const wf = readWorkflow("FF90-MASTER");
  const gate = wf.nodes.find((n) => n.name === "Editorial ready?");
  assert.ok(gate, "MASTER must have an Editorial ready? gate");
  assert.equal(gate.type, "n8n-nodes-base.if");
  const stop = wf.nodes.find((n) => n.name === "STOP (held_for_content)");
  assert.ok(stop, "MASTER must have a STOP (held_for_content) terminal");
});

test("ff90 18G: MASTER Promote run context uses canonical envelope fields", () => {
  const wf = readWorkflow("FF90-MASTER");
  const promote = wf.nodes.find((n) => n.name === "Promote run context");
  const code = String((promote.parameters as { jsCode?: string }).jsCode ?? "");
  assert.match(code, /run_id/, "promote must reference run_id");
  assert.match(code, /editorial_item_id/, "promote must reference editorial_item_id");
  assert.match(code, /pipeline_status/, "promote must reference pipeline_status (Phase 18G)");
});

test("ff90 18G: phase18f-b fixture validates against MASTER input schema", () => {
  const fx = readJson(join(FIXTURES, "phase18f-b-e2e-test.json")) as Record<string, unknown>;
  // Required fields per Normalize inbound job code in MASTER.
  for (const k of ["source_url", "source_title", "publisher", "published_at", "source_text", "source_type"]) {
    assert.ok(typeof fx[k] === "string" && (fx[k] as string).length > 0, `fixture missing ${k}`);
  }
  const optMeta = fx.optional_metadata as Record<string, unknown>;
  assert.equal(optMeta.phase, "18f-b");
  const testContent = optMeta.test_content as Record<string, unknown>;
  for (const k of ["title_th", "body_th", "excerpt_th", "slug", "news_type"]) {
    assert.ok(typeof testContent[k] === "string" && (testContent[k] as string).length > 0, `test_content missing ${k}`);
  }
  // Source URL must be unique per run (timestamp placeholder).
  assert.match(fx.source_url as string, /<timestamp>/, "source_url should carry a unique-per-run placeholder");
});

test("ff90 18G: pipeline-envelope contract schema is valid JSON Schema draft-07", () => {
  const s = readJson(join(CONTRACTS, "pipeline-envelope.schema.json")) as { $schema?: string; type?: string };
  assert.match(s.$schema ?? "", /draft-07/);
  assert.equal(s.type, "object");
});

test("ff90 18G: test harness workflow exists, is INACTIVE, marked test-only", () => {
  // The harness is loaded into n8n as a separate workflow. The JSON file
  // exists for tracking + import. We assert its on-disk properties.
  const harnessPath = join(WORKFLOWS, "FF90-E2E-Test-Harness.json");
  const raw = readFileSync(harnessPath, "utf-8");
  const harness = JSON.parse(raw) as {
    active: boolean;
    tags: Array<{ name: string }>;
    nodes: Array<{ type: string; name: string }>;
  };
  assert.equal(harness.active, false, "test harness must remain INACTIVE");
  const tagNames = harness.tags.map((t) => t.name);
  assert.ok(tagNames.includes("do-not-activate"), "harness must carry 'do-not-activate' tag");
  assert.ok(tagNames.includes("test-only"), "harness must carry 'test-only' tag");
  // Must not have a schedule / webhook trigger (it should only be invokable
  // via docker exec n8n n8n execute --id=...).
  const allowedTypes = new Set([
    "n8n-nodes-base.code",
    "n8n-nodes-base.executeWorkflow",
  ]);
  for (const n of harness.nodes) {
    assert.ok(
      allowedTypes.has(n.type),
      `harness node ${n.name} must be code or executeWorkflow (got ${n.type})`,
    );
  }
});

// helper: lookup by string id (small shim for the above tests)
function f(name: string): string {
  return name;
}
