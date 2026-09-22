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
  for (const n of next(w, 'Provider configured?', 1)) {
    assert.ok(reaches(w, n, 'Promote FF90-03 output'));
    assert.equal(reaches(w, n, 'POST image provider'), false);
  }
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
