// Offline source audit only: never executes a workflow or contacts an API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const names = ['FF90-01-source-intake', 'FF90-02-editorial-factory', 'FF90-03-image-factory', 'FF90-04-wordpress-draft', 'FF90-05-human-review'];
const read = name => JSON.parse(readFileSync(new URL(`../workflows/${name}.json`, import.meta.url), 'utf8'));
const next = (w, name, branch = 0) => (w.connections[name]?.main[branch] || []).map(e => e.node);
function reaches(w, from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return (w.connections[from]?.main || []).flat().some(e => reaches(w, e.node, to, seen));
}

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

test('MASTER child IDs equal the previous committed baseline', () => {
  const baseline = JSON.parse(execFileSync('git', ['show', '337c2d48fcf34cea4bc66b7f43b44fe72122f7df:football-factory/automation/n8n/workflows/FF90-MASTER.json'], { encoding: 'utf8' }));
  const ids = w => w.nodes.filter(n => n.type === 'n8n-nodes-base.executeWorkflow').map(n => n.parameters.workflowId);
  assert.deepEqual(ids(read('FF90-MASTER')), ids(baseline));
});
