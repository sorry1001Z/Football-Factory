// Offline source audit only: never executes a workflow or contacts an API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const names = ['FF90-01-source-intake', 'FF90-02-editorial-factory', 'FF90-03-image-factory', 'FF90-04-wordpress-draft', 'FF90-05-human-review'];
const read = name => JSON.parse(readFileSync(new URL(`../workflows/${name}.json`, import.meta.url), 'utf8'));
const next = (w, name, branch = 0) => (w.connections[name]?.main[branch] || []).map(e => e.node);
function reaches(w, from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return (w.connections[from]?.main || []).flat().some(e => reaches(w, e.node, to, seen));
}

test('children have exactly one passthrough subworkflow entry and no autonomous trigger', () => {
  const firstNodes = ['Normalize source', 'Preserve editorial input', 'Build image prompt', 'Validate editorial fields', 'Resolve publish mode'];
  names.forEach((name, i) => {
    const w = read(name);
    const triggers = w.nodes.filter(n => /trigger|webhook/i.test(n.type));
    assert.equal(triggers.length, 1, name);
    const trigger = triggers[0];
    assert.equal(trigger.type, 'n8n-nodes-base.executeWorkflowTrigger');
    assert.equal(trigger.typeVersion, 1.1);
    assert.deepEqual(trigger.parameters, { inputSource: 'passthrough' });
    assert.notEqual(trigger.disabled, true);
    assert.equal(w.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger'), false);
    assert.deepEqual(next(w, trigger.name), [firstNodes[i]]);
    assert.ok(reaches(w, trigger.name, `Promote FF90-0${i + 1} output`));
  });
});

test('MASTER keeps its production webhook and accepts the harness through a subworkflow entry', () => {
  const w = read('FF90-MASTER');
  const webhook = w.nodes.filter(n => n.type === 'n8n-nodes-base.webhook');
  assert.equal(webhook.length, 1);
  assert.equal(webhook[0].name, 'Webhook: source job intake');
  assert.equal(webhook[0].parameters.path, 'ff90-master-intake');
  const sub = w.nodes.filter(n => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  assert.equal(sub.length, 1);
  assert.equal(sub[0].typeVersion, 1.1);
  assert.deepEqual(sub[0].parameters, { inputSource: 'passthrough' });
  for (const entry of [webhook[0], sub[0]]) {
    assert.deepEqual(next(w, entry.name), ['Normalize inbound job']);
    assert.ok(reaches(w, entry.name, 'Editorial ready?'));
    assert.ok(reaches(w, entry.name, 'STOP (held_for_content)'));
  }
  assert.equal(w.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger'), false);
  const harness = read('FF90-E2E-Test-Harness');
  assert.equal(harness.active, false);
  for (const tag of ['test-only', 'do-not-activate']) assert.ok(harness.tags.some(t => t.name === tag));
  assert.equal(harness.nodes.some(n => /trigger|webhook/i.test(n.type)), false);
});

test('every audit branch reaches its terminal canonical promote', () => {
  names.forEach((name, i) => {
    const w = read(name);
    for (const n of w.nodes.filter(n => n.name.startsWith('Audit log') || ['APPROVE branch', 'REJECT branch'].includes(n.name))) {
      assert.ok(reaches(w, n.name, `Promote FF90-0${i + 1} output`), `${name}: disconnected ${n.name}`);
    }
  });
});

test('missing content cannot reach AI or WordPress HTTP calls', () => {
  for (const [file, validator, gate, http] of [
    [names[1], 'Classify news type', 'Content ready?', 'POST /api/automation/ai-assist'],
    [names[3], 'Validate editorial fields', 'Editorial fields valid?', 'POST /api/automation/wp-draft'],
  ]) {
    const w = read(file);
    assert.deepEqual(next(w, validator), [gate]);
    const g = w.nodes.find(n => n.name === gate);
    assert.equal(g.parameters.conditions.conditions[0].rightValue, 'accepted');
    assert.ok(next(w, gate, 0).some(n => reaches(w, n, http)));
    assert.ok(next(w, gate, 1).length);
    for (const n of next(w, gate, 1)) assert.equal(reaches(w, n, http), false);
  }
});

test('image-not-configured path returns its envelope without requiring an asset', () => {
  const w = read(names[2]);
  assert.equal(w.nodes.some(n => n.name === 'POST image provider'), false);
  assert.ok(reaches(w, 'Provider adapter', 'Audit log (held)'));
  assert.ok(reaches(w, 'Audit log (held)', 'Promote FF90-03 output'));
  const draft = read(names[3]);
  assert.ok(reaches(draft, next(draft, 'Have asset bytes?', 1)[0], 'Promote FF90-04 output'));
});

test('workflow graph targets exist and embedded JavaScript parses without execution', () => {
  for (const name of [...names, 'FF90-MASTER', 'FF90-E2E-Test-Harness']) {
    const w = read(name);
    const labels = new Set(w.nodes.map(n => n.name));
    assert.equal(labels.size, w.nodes.length);
    for (const [from, connection] of Object.entries(w.connections)) {
      assert.ok(labels.has(from));
      for (const edge of connection.main.flat()) assert.ok(labels.has(edge.node), `${name}: ${edge.node}`);
    }
    for (const n of w.nodes) {
      if (n.parameters.jsCode) new Function(n.parameters.jsCode);
    }
  }
});

// Production runtime ID map confirmed by the operator in Phase 18G-R2.
// These are Execute Workflow targets; top-level logical IDs remain metadata.
const productionRuntimeIds = {
  'ff90-01': 'kwpSls38bmydgZK3',
  'ff90-02': 'MfMkjlDg1SnEUk3r',
  'ff90-03': 'hGQx1nGDbBPXgD83',
  'ff90-04': 'YvfaWlJGZfUBEkSC',
  'ff90-05': 'HOc6FXMlouQJDMAl',
  'ff90-master': 'mer7yesS2YkeQQa7',
};

test('MASTER resolves all five Execute Workflow targets against the production map', () => {
  const master = read('FF90-MASTER');
  const exec = master.nodes.filter(n => n.type === 'n8n-nodes-base.executeWorkflow');
  assert.equal(master.id, 'ff90-master');
  assert.equal(exec.length, 5);
  names.forEach((name, i) => {
    const logicalId = name.slice(0, 7).toLowerCase();
    const target = exec.find(n => n.id === `ff90-master-exec-0${i + 1}`);
    assert.ok(target, `missing Execute Workflow node for ${logicalId}`);
    assert.equal(target.parameters.workflowId, productionRuntimeIds[logicalId]);
    assert.equal(read(name).id, logicalId);
  });
  for (const n of exec) assert.doesNotMatch(n.parameters.workflowId, /^ff90-0[1-5]$/);
});

test('harness targets the production MASTER runtime ID, never its logical ID', () => {
  const harness = read('FF90-E2E-Test-Harness');
  const refs = harness.nodes.filter(n => n.type === 'n8n-nodes-base.executeWorkflow').map(n => n.parameters.workflowId);
  assert.deepEqual(refs, [productionRuntimeIds['ff90-master']]);
  assert.equal(refs.includes('ff90-master'), false);
  assert.equal(harness.id, 'ff90-e2e-test-harness');
});

test('all seven workflows remain inactive with no executable wp-publish target', () => {
  for (const name of [...names, 'FF90-MASTER', 'FF90-E2E-Test-Harness']) {
    const w = read(name);
    assert.equal(w.active, false, name);
    for (const n of w.nodes) assert.doesNotMatch(n.parameters.url || '', /wp-publish/);
  }
});

test('executable Code nodes in the full FF90 chain load no disallowed modules', () => {
  const disallowed = /\brequire\s*\(|\bimport\s*(?:\(|['"]|[^\n;]*?\sfrom\s*['"])|\bnode:(?:crypto|fs|path|os|child_process|net|tls|http|https)\b|(?:require\s*\(\s*|\bfrom\s*)['"](?:crypto|fs|path|os|child_process|net|tls|http|https)['"]/;
  const hits = [];
  for (const name of [...names, 'FF90-MASTER', 'FF90-E2E-Test-Harness']) {
    for (const node of read(name).nodes) {
      if (node.type !== 'n8n-nodes-base.code' || !node.parameters.jsCode) continue;
      if (disallowed.test(node.parameters.jsCode)) hits.push(`${name}:${node.name}`);
    }
  }
  assert.deepEqual(hits, []);
  const normalizer = read(names[0]).nodes.find(n => n.name === 'Normalize source').parameters.jsCode;
  assert.doesNotMatch(normalizer, /\brequire\s*\(\s*['"]crypto['"]\s*\)/);
});

const automationCredentialId = 'oDa6RRKZleN2DC71';
const automationCredentialName = 'FF90 Automation Secret';
const authContract = {
  'FF90-01-source-intake': [
    ['POST /api/automation/deduplicate', 'POST', 'https://www.ff90.online/api/automation/deduplicate'],
    ['POST /api/automation/editorial-item', 'POST', 'https://www.ff90.online/api/automation/editorial-item'],
    ['Audit log', 'POST', 'https://www.ff90.online/api/automation/log'],
  ],
  'FF90-02-editorial-factory': [
    ['GET /api/automation/run/{run_id}', 'GET', '=https://www.ff90.online/api/automation/run/{{ $json.run_id }}'],
    ['POST /api/automation/ai-assist', 'POST', 'https://www.ff90.online/api/automation/ai-assist'],
    ['POST /api/automation/seo-check', 'POST', 'https://www.ff90.online/api/automation/seo-check'],
    ['POST /api/automation/fact-check', 'POST', 'https://www.ff90.online/api/automation/fact-check'],
    ['Audit log', 'POST', 'https://www.ff90.online/api/automation/log'],
  ],
  'FF90-03-image-factory': [
    ['POST /api/automation/rights-check', 'POST', 'https://www.ff90.online/api/automation/rights-check'],
    ['Audit log', 'POST', 'https://www.ff90.online/api/automation/log'],
    ['Audit log (held)', 'POST', 'https://www.ff90.online/api/automation/log'],
  ],
  'FF90-04-wordpress-draft': [
    ['POST /api/automation/wp-draft', 'POST', 'https://www.ff90.online/api/automation/wp-draft'],
    ['POST /api/automation/media', 'POST', 'https://www.ff90.online/api/automation/media'],
    ['Audit log', 'POST', 'https://www.ff90.online/api/automation/log'],
    ['Audit log (no image)', 'POST', 'https://www.ff90.online/api/automation/log'],
  ],
  'FF90-05-human-review': [
    ['POST /api/automation/alert (review-ready)', 'POST', 'https://www.ff90.online/api/automation/alert'],
  ],
};

test('exactly 16 automation HTTP nodes use the one Hermes-provisioned Header Auth credential', () => {
  let count = 0;
  for (const [file, expected] of Object.entries(authContract)) {
    const w = read(file);
    for (const [name, method, url] of expected) {
      const n = w.nodes.find(n => n.name === name && n.type === 'n8n-nodes-base.httpRequest');
      assert.ok(n, `${file}:${name}`);
      count++;
      assert.equal(n.parameters.authentication, 'genericCredentialType');
      assert.equal(n.parameters.genericAuthType, 'httpHeaderAuth');
      assert.deepEqual(n.credentials?.httpHeaderAuth, { id: automationCredentialId, name: automationCredentialName });
      const headers = n.parameters.headerParameters?.parameters || [];
      assert.equal(headers.filter(h => h.name?.toLowerCase() === 'x-automation-secret').length, 0);
      assert.equal(n.parameters.method || 'GET', method);
      assert.equal(n.parameters.url, url);
      if (n.parameters.sendBody) assert.ok(n.parameters.jsonBody || n.parameters.multipartParameters || n.parameters.bodyParameters, `${name}: body contract missing`);
    }
  }
  assert.equal(count, 16);
});

test('no executable workflow parameter retains blocked environment expressions or inline auth values', () => {
  for (const name of [...names, 'FF90-MASTER', 'FF90-E2E-Test-Harness']) {
    const w = read(name);
    for (const n of w.nodes) {
      assert.doesNotMatch(JSON.stringify(n.parameters || {}), /\$env\./, `${name}:${n.name}`);
      for (const h of n.parameters.headerParameters?.parameters || []) {
        assert.notEqual(h.name?.toLowerCase(), 'x-automation-secret');
      }
      const credential = n.credentials?.httpHeaderAuth;
      if (credential?.name === automationCredentialName) assert.deepEqual(Object.keys(credential).sort(), ['id', 'name']);
    }
  }
});

test('provider and manual-review nodes have fixed fail-closed settings with no env dependency', () => {
  const image = read(names[2]);
  const adapter = image.nodes.find(n => n.name === 'Provider adapter').parameters.jsCode;
  assert.match(adapter, /provider_status:\s*'NOT_CONFIGURED'/);
  assert.match(adapter, /image_status:\s*'held'/);
  assert.match(adapter, /output_asset:\s*null/);
  assert.equal(image.nodes.some(n => n.name === 'POST image provider'), false);
  assert.ok(reaches(image, 'Provider adapter', 'Promote FF90-03 output'));

  const review = read(names[4]);
  const mode = review.nodes.find(n => n.name === 'Resolve publish mode').parameters.jsCode;
  assert.match(mode, /modeRaw\s*=\s*'manual_review'/);
  assert.doesNotMatch(mode, /\$env\./);
  const reject = review.nodes.find(n => n.name === 'REJECT branch').parameters.jsCode;
  assert.match(reject, /review_decision !== 'rejected'/);
  assert.match(reject, /review_status:\s*'pending'/);
  assert.match(reject, /pipeline_status:\s*'waiting_human_review'/);
});
