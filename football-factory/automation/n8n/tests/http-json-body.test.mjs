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
  source_id: 'src:1234567890abcdef1234567890abcdef1234567890abcdef',
  canonical_url: 'https://example.invalid/ff90-e2d5-test',
  source_url: 'https://example.invalid/ff90-e2d5-test',
  source_title: '[FF90 TEST] dedupe body',
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
  'Provider adapter': { ...input },
  'POST /api/automation/deduplicate': { run_id: input.run_id },
  'POST /api/automation/editorial-item': { editorial_item_id: input.editorial_item_id },
  'POST /api/automation/ai-assist': { provider_status: 'not_configured', content_hash: 'synthetic' },
  'POST /api/automation/seo-check': { seo_check_status: 'clear' },
  'POST /api/automation/fact-check': { state: 'pending_manual', provider_status: 'not_configured' },
  'POST /api/automation/wp-draft': { wp_post_id: 123, idempotent: false },
};

function evaluateExpression(body, nodeName) {
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
    assert.fail(`${nodeName}: expression must return a value`);
  }
}

function evaluateKeypairBody(node, nodeName) {
  assert.equal(node.parameters.specifyBody, 'keypair', `${nodeName}: expected keypair mode`);
  const fields = node.parameters.bodyParameters?.parameters;
  assert.ok(Array.isArray(fields) && fields.length > 0, `${nodeName}: missing key/value body parameters`);
  const body = {};
  for (const field of fields) {
    assert.equal(typeof field.name, 'string');
    assert.equal(Object.hasOwn(body, field.name), false, `${nodeName}: duplicate body field ${field.name}`);
    body[field.name] = typeof field.value === 'string' && field.value.startsWith('={{')
      ? evaluateExpression(field.value, `${nodeName}:${field.name}`)
      : field.value;
  }
  return body;
}

function evaluateBodyNode(node, nodeName) {
  if (node.parameters.specifyBody === 'keypair') return evaluateKeypairBody(node, nodeName);
  return evaluateExpression(node.parameters.jsonBody, nodeName);
}

function requestBodyNodes() {
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

test('all FF90 HTTP JSON bodies evaluate to objects using expression or keypair mode', () => {
  const nodes = requestBodyNodes();
  assert.equal(nodes.length, 16);
  assert.equal(nodes.filter(({ node }) => node.parameters.specifyBody === 'json').length, 0);
  assert.equal(nodes.filter(({ node }) => node.parameters.specifyBody === 'keypair').length, 16);
  for (const { workflowName, node } of nodes) {
    assert.equal(node.parameters.jsonBody, undefined, `${workflowName}:${node.name} must not use JSON/expression hybrid body mode`);
    assert.doesNotMatch(JSON.stringify(node.parameters), /JSON\.stringify\s*\(/, `${workflowName}:${node.name} must not stringify its body`);
    const evaluated = evaluateBodyNode(node, `${workflowName}:${node.name}`);
    assert.equal(typeof evaluated, 'object', `${workflowName}:${node.name} must evaluate to an object`);
    assert.ok(evaluated !== null && !Array.isArray(evaluated), `${workflowName}:${node.name} must evaluate to a JSON object`);
    const serialized = JSON.stringify(evaluated);
    const parsed = JSON.parse(serialized);
    assert.equal(typeof parsed, 'object', `${workflowName}:${node.name} must parse after serialization`);
  }
});

test('FF90-01 editorial-item and Audit log use keypair bodies with correct dynamic values', () => {
  const workflow = read('FF90-01-source-intake');
  const editorial = workflow.nodes.find(n => n.name === 'POST /api/automation/editorial-item');
  const audit = workflow.nodes.find(n => n.name === 'Audit log');
  for (const node of [editorial, audit]) {
    assert.ok(node);
    assert.equal(node.parameters.specifyBody, 'keypair');
    assert.equal(node.parameters.contentType, 'json');
    assert.equal(node.parameters.jsonBody, undefined);
  }
  const editorialBody = evaluateKeypairBody(editorial, editorial.name);
  assert.equal(editorialBody.run_id, input.run_id);
  assert.equal(editorialBody.source_id, input.source_id);
  assert.equal(editorialBody.title, input.source_title);
  assert.deepEqual(Object.keys(editorialBody.metadata).sort(), ['competition', 'people', 'published_at', 'source_intake_run_at', 'source_type', 'teams']);
  assert.match(editorialBody.metadata.source_intake_run_at, /^\d{4}-\d\d-/);
  const auditBody = evaluateKeypairBody(audit, audit.name);
  assert.equal(auditBody.run_id, input.run_id);
  assert.equal(auditBody.event_type, 'ff90_01_source_intake_complete');
  assert.equal(Object.hasOwn(auditBody, 'action'), false);
  assert.equal(auditBody.metadata.editorial_item_id, input.editorial_item_id);
});

test('FF90-02 through FF90-05 dynamic HTTP JSON bodies use keypair mode', () => {
  for (const { workflowName, node } of requestBodyNodes().filter(({ workflowName }) => workflowName !== 'FF90-01-source-intake')) {
    assert.equal(node.parameters.specifyBody, 'keypair', `${workflowName}:${node.name}`);
    assert.equal(node.parameters.jsonBody, undefined, `${workflowName}:${node.name}`);
    const evaluated = evaluateKeypairBody(node, `${workflowName}:${node.name}`);
    assert.equal(typeof evaluated, 'object');
    assert.ok(evaluated !== null && !Array.isArray(evaluated));
  }
});

test('FF90-02 SEO and fact-check requests use the canonical editorial fields and route contracts', () => {
  const workflow = read('FF90-02-editorial-factory');
  const seo = workflow.nodes.find(n => n.name === 'POST /api/automation/seo-check');
  const ai = workflow.nodes.find(n => n.name === 'POST /api/automation/ai-assist');
  const fact = workflow.nodes.find(n => n.name === 'POST /api/automation/fact-check');
  const seoBody = evaluateKeypairBody(seo, seo.name);
  const aiBody = evaluateKeypairBody(ai, ai.name);
  const factBody = evaluateKeypairBody(fact, fact.name);
  assert.deepEqual(Object.keys(seoBody).sort(), ['content', 'description', 'editorial_item_id', 'run_id', 'slug', 'title']);
  assert.equal(seoBody.run_id, input.run_id);
  assert.equal(seoBody.editorial_item_id, input.editorial_item_id);
  assert.equal(seoBody.title, input.title_th);
  assert.equal(seoBody.content, input.body_th);
  assert.equal(seoBody.slug, input.slug);
  assert.equal(seoBody.description, input.excerpt_th);
  assert.deepEqual(Object.keys(aiBody).sort(), ['content', 'editorial_item_id', 'run_id']);
  assert.equal(aiBody.content, input.body_th);
  assert.deepEqual(Object.keys(factBody).sort(), ['content', 'editorial_item_id', 'run_id']);
  assert.equal(factBody.content, input.body_th);
  assert.match(workflow.nodes.find(n => n.name === 'Audit log').parameters.bodyParameters.parameters.find(p => p.name === 'status').value, /\.state === 'cleared'/);
});

test('FF90-03..05 callers use actual rights, draft, media, and alert route fields', () => {
  const image = read('FF90-03-image-factory');
  const rights = image.nodes.find(n => n.name === 'POST /api/automation/rights-check');
  const rightsBody = evaluateKeypairBody(rights, rights.name);
  assert.deepEqual(Object.keys(rightsBody).sort(), ['editorial_item_id', 'run_id', 'source_name', 'source_url', 'state']);
  assert.equal(rightsBody.state, 'manual_review');
  assert.equal(rightsBody.source_url, input.source_url);
  assert.equal(rightsBody.source_name, input.publisher);
  const providerGate = image.connections['Provider configured?'].main;
  assert.equal(providerGate[0][0].node, 'POST /api/automation/rights-check');
  assert.equal(providerGate[1][0].node, 'Audit log (held)');
  assert.equal(image.connections['Audit log (held)'].main[0][0].node, 'POST /api/automation/rights-check');
  assert.equal(image.connections['POST /api/automation/rights-check'].main[0][0].node, 'Restore rights context');
  assert.equal(image.connections['Restore rights context'].main[0][0].node, 'Visual relevance gate');

  const draftWorkflow = read('FF90-04-wordpress-draft');
  const draft = draftWorkflow.nodes.find(n => n.name === 'POST /api/automation/wp-draft');
  const draftBody = evaluateKeypairBody(draft, draft.name);
  assert.deepEqual(Object.keys(draftBody).sort(), ['content', 'editorial_item_id', 'recovery_id', 'run_id', 'title']);
  assert.equal(draftBody.title, input.title_th);
  assert.equal(draftBody.content, input.body_th);
  const media = draftWorkflow.nodes.find(n => n.name === 'POST /api/automation/media');
  const multipart = media.parameters.multipartParameters.parameters;
  assert.deepEqual(multipart.filter(p => p.parameterType === 'formData').map(p => p.name).sort(), ['alt_text', 'caption', 'editorial_item_id', 'post_id', 'run_id', 'title'].sort());
  assert.deepEqual(multipart.find(p => p.parameterType === 'formBinaryData'), {
    parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'binary_data',
  });
  assert.ok(multipart.some(p => p.name === 'run_id' && p.value === '={{ $json.run_id }}'));
  assert.ok(multipart.some(p => p.name === 'editorial_item_id' && p.value === '={{ $json.editorial_item_id }}'));

  const review = read('FF90-05-human-review');
  const alert = review.nodes.find(n => n.name === 'POST /api/automation/alert (review-ready)');
  const alertBody = evaluateKeypairBody(alert, alert.name);
  assert.deepEqual(Object.keys(alertBody).sort(), ['context', 'message', 'run_id', 'severity', 'source']);
  assert.equal(alertBody.severity, 'info');
  assert.equal(typeof alertBody.context, 'object');
});

test('FF90-01 dedupe body evaluates to the API contract as an object', () => {
  const workflow = read('FF90-01-source-intake');
  const node = workflow.nodes.find(n => n.name === 'POST /api/automation/deduplicate');
  assert.equal(node.typeVersion, 4.2);
  assert.equal(node.parameters.sendBody, true);
  assert.equal(node.parameters.contentType, 'json');
  assert.equal(node.parameters.specifyBody, 'keypair');
  const fields = node.parameters.bodyParameters.parameters;
  assert.deepEqual(fields.map(field => field.name), ['idempotency_key', 'workflow', 'payload']);
  const evaluated = evaluateKeypairBody(node, node.name);
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
  for (const { workflowName, node } of requestBodyNodes()) {
    const evaluated = evaluateBodyNode(node, `${workflowName}:${node.name}`);
    assert.equal(typeof evaluated, 'object', `${workflowName}:${node.name} returned serialized/string-built JSON`);
    assert.doesNotMatch(JSON.stringify(evaluated), /\$json/, `${workflowName}:${node.name} contains unevaluated expressions`);
    assert.equal(node.parameters.specifyBody, 'keypair');
    assert.equal(node.parameters.jsonBody, undefined);
  }
});
