// Evaluate n8n HTTP Request JSON-body expressions offline with representative
// workflow data. This does not invoke n8n, the network, or any API route.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const workflowNames = [
  'FF90-01-source-intake',
  'FF90-02-editorial-factory',
  'FF90-03-image-factory',
  'FF90-04-wordpress-draft',
  'FF90-05-human-review',
  'FF90-MASTER',
  'FF90-E2E-Test-Harness',
];
const read = name => JSON.parse(readFileSync(new URL(`../workflows/${name}.json`, import.meta.url), 'utf8'));
const input = {
  run_id: 'run-phase18he2d3',
  editorial_item_id: 'editorial-phase18he2d3',
  source_id: `src:${'a'.repeat(48)}`,
  canonical_url: 'https://example.invalid/ff90-json-body-test',
  source_title: '[FF90 TEST] JSON body',
  publisher: 'FF90-TEST',
  source_type: 'test',
  source_text: 'Synthetic test content',
  published_at: '2026-09-23T00:00:00+07:00',
  competition: [],
  teams: [],
  people: [],
  article_prompt: 'Synthetic article prompt',
  news_type: 'test',
  title: 'Synthetic title',
  content: 'Synthetic content',
  slug: 'synthetic-title',
  excerpt: 'Synthetic excerpt',
  title_th: 'หัวข้อทดสอบ',
  body_th: 'เนื้อหาทดสอบ',
  excerpt_th: 'คำโปรยทดสอบ',
  review_payload: { synthetic: true },
  provider_status: 'NOT_CONFIGURED',
  provider: 'none',
  request_id: null,
  output_asset: null,
  visual_relevance: 'NOT_CONFIGURED',
};
const nodeOutputs = {
  'POST /api/automation/deduplicate': { run_id: input.run_id },
  'POST /api/automation/editorial-item': { editorial_item_id: input.editorial_item_id },
  'POST /api/automation/ai-assist': { title: input.title, content: input.content, slug: input.slug, excerpt: input.excerpt },
  'POST /api/automation/seo-check': { seo_check_status: 'clear' },
  'POST /api/automation/fact-check': { fact_check_state: 'cleared', provider_status: 'test' },
  'POST /api/automation/wp-draft': { wp_post_id: 123, idempotent: false },
};

function evaluateJsonBody(body, nodeName) {
  if (typeof body !== 'string') return body;
  if (body.startsWith('={{') && body.endsWith('}}')) {
    const expression = body.slice(3, -2);
    return runInNewContext(`(${expression})`, {
      $json: structuredClone(input),
      $: name => ({ item: { json: structuredClone(nodeOutputs[name] ?? {}) } }),
      Date,
    }, { timeout: 1000 });
  }
  try {
    return JSON.parse(body);
  } catch {
    assert.fail(`${nodeName}: JSON body must be a valid object expression or static JSON`);
  }
}

function jsonBodyNodes() {
  const result = [];
  for (const workflowName of workflowNames) {
    const workflow = read(workflowName);
    for (const node of workflow.nodes) {
      const p = node.parameters ?? {};
      if (node.type === 'n8n-nodes-base.httpRequest' && p.sendBody && (p.specifyBody === 'json' || p.contentType === 'json' || p.jsonBody !== undefined)) {
        result.push({ workflowName, node, body: p.jsonBody });
      }
    }
  }
  return result;
}

test('all FF90 HTTP JSON bodies evaluate to objects or valid static JSON', () => {
  const nodes = jsonBodyNodes();
  assert.equal(nodes.length, 14);
  for (const { workflowName, node, body } of nodes) {
    assert.doesNotMatch(String(body), /JSON\.stringify\s*\(/, `${workflowName}:${node.name} must not stringify its body expression`);
    const evaluated = evaluateJsonBody(body, `${workflowName}:${node.name}`);
    assert.equal(typeof evaluated, 'object', `${workflowName}:${node.name} must evaluate to an object`);
    assert.ok(evaluated !== null && !Array.isArray(evaluated), `${workflowName}:${node.name} must evaluate to a JSON object`);
    const serialized = JSON.stringify(evaluated);
    const parsed = JSON.parse(serialized);
    assert.equal(typeof parsed, 'object', `${workflowName}:${node.name} must parse after serialization`);
  }
});

test('FF90-01 dedupe body evaluates to the API contract as an object', () => {
  const workflow = read('FF90-01-source-intake');
  const node = workflow.nodes.find(n => n.name === 'POST /api/automation/deduplicate');
  const evaluated = evaluateJsonBody(node.parameters.jsonBody, node.name);
  assert.equal(typeof evaluated, 'object');
  assert.ok(evaluated !== null && !Array.isArray(evaluated));
  const body = JSON.parse(JSON.stringify(evaluated));
  assert.doesNotThrow(() => JSON.stringify(evaluated));
  assert.equal(body.idempotency_key, `ff90-01:${input.source_id}`);
  assert.equal(body.workflow, 'FF90-01-source-intake');
  assert.deepEqual(Object.keys(body).sort(), ['idempotency_key', 'payload', 'workflow']);
  assert.deepEqual(body.payload, {
    source_id: input.source_id,
    canonical_url: input.canonical_url,
    source_title: input.source_title,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(body)), body);
});

test('FF90 HTTP JSON bodies contain no concatenated JSON text or expression-string bodies', () => {
  for (const { workflowName, node, body } of jsonBodyNodes()) {
    const evaluated = evaluateJsonBody(body, `${workflowName}:${node.name}`);
    assert.equal(typeof evaluated, 'object', `${workflowName}:${node.name} returned serialized/string-built JSON`);
    assert.doesNotMatch(String(body), /^=\s*['"`].*\$json/s, `${workflowName}:${node.name} builds JSON as a string`);
  }
});
