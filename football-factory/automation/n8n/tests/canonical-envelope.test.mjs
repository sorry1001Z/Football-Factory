// Pure Code-node unit tests with synthetic data and stubbed HTTP outputs.
// No n8n engine, workflow execution, network, real environment, or database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';

const read = name => JSON.parse(readFileSync(new URL(`../workflows/${name}.json`, import.meta.url), 'utf8'));
function code(w, name, input, outputs = {}) {
  const node = w.nodes.find(n => n.name === name);
  assert.ok(node?.parameters.jsCode, name);
  const result = runInNewContext(`(function () { ${node.parameters.jsCode} })()`, {
    $json: structuredClone(input),
    items: [{ json: structuredClone(input) }],
    $env: {},
    $: label => {
      assert.ok(Object.hasOwn(outputs, label), `unexpected node lookup: ${label}`);
      return { item: { json: structuredClone(outputs[label]) } };
    },
  }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(result[0].json));
}

const normalizeCode = read('FF90-01-source-intake').nodes.find(n => n.name === 'Normalize source').parameters.jsCode;
const hashStart = normalizeCode.indexOf('function sha256(input) {');
const hashEndMarker = '\n}\n\nconst item = items[0].json;';
const hashEnd = normalizeCode.indexOf(hashEndMarker, hashStart);
assert.ok(hashStart >= 0 && hashEnd > hashStart, 'embedded pure SHA-256 function is present');
const pureSha256Source = normalizeCode.slice(hashStart, hashEnd + 2);
function pureHash(input) {
  return runInNewContext(`(${pureSha256Source})(input)`, { input }, { timeout: 1000 });
}

test('pure JavaScript SHA-256 matches the standard abc vector', () => {
  assert.equal(pureHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('pure SHA-256 is deterministic, distinguishes input, and returns lowercase 64-char hex', () => {
  const first = pureHash('same input');
  assert.equal(first, pureHash('same input'));
  assert.notEqual(first, pureHash('different input'));
  assert.equal(first.length, 64);
  assert.match(first, /^[0-9a-f]{64}$/);
});

const source = {
  source_url: 'https://test.ff90.online/envelope-unit-test',
  source_title: 'Synthetic source', publisher: 'test-only', published_at: '2026-09-23T00:00:00Z',
  source_text: 'Synthetic content', source_type: 'other', competition: 'test',
  teams: ['test-a', 'test-b'], people: ['test-person'], requested_by: 'unit-test',
  optional_metadata: { phase: '18f-b', test_marker: 'unit-test', test_content: {
    title_th: 'Synthetic title', body_th: 'Synthetic body', excerpt_th: 'Synthetic excerpt',
    news_type: 'test', slug: 'synthetic-test',
  } },
  extension_field: { retained: true },
};
const envelope = {
  ...source, run_id: '11111111-1111-4111-8111-111111111111',
  editorial_item_id: '22222222-2222-4222-8222-222222222222', source_id: 'src:unit-test',
  ...source.optional_metadata.test_content, pipeline_status: 'accepted',
};
function retained(actual, expected, keys = Object.keys(expected)) {
  for (const key of keys) assert.deepEqual(actual[key], expected[key], `lost field: ${key}`);
}

test('FF90-01 retains source input including optional metadata and extensions at Promote', () => {
  const w = read('FF90-01-source-intake');
  const normalized = code(w, 'Normalize source', source);
  const output = code(w, 'Promote FF90-01 output', { ok: true }, {
    'Normalize source': normalized,
    'POST /api/automation/editorial-item': envelope,
  });
  retained(output, source);
  retained(output, envelope, ['run_id', 'editorial_item_id']);
});

test('FF90-01 production hash input and source_id match Node SHA-256 exactly', () => {
  const w = read('FF90-01-source-intake');
  const input = {
    source_url: '  https://example.test/story  ', source_title: 'A title',
    published_at: '2026-09-23T09:30:00Z', source_text: 'body',
  };
  const normalized = code(w, 'Normalize source', input);
  const exactInput = 'https://example.test/story\u00002026-09-23T09:30:00Z';
  const expected = createHash('sha256').update(exactInput).digest('hex');
  assert.equal(pureHash(exactInput), expected);
  assert.equal(normalized.source_id, `src:${expected.slice(0, 48)}`);
  assert.equal(normalized.source_id.length, 52);
});

test('MASTER unwraps the real webhook body and preserves the complete source contract', () => {
  const master = read('FF90-MASTER');
  const payload = {
    source_url: 'https://example.invalid/ff90-envelope-test',
    source_title: '[FF90 TEST] Envelope',
    publisher: 'FF90-TEST',
    published_at: '2026-09-23T00:00:00+07:00',
    source_text: 'Synthetic test content.',
    source_type: 'test',
    competition: [],
    teams: [],
    people: [],
    requested_by: 'phase18he2d1',
    optional_metadata: { test_only: true },
  };
  const wrapped = {
    headers: { authorization: 'synthetic-transport-value', 'x-automation-secret': 'synthetic-transport-value' },
    query: { trace: 'synthetic-transport-value' },
    body: payload,
    webhookUrl: 'https://example.invalid/webhook',
    executionMode: 'production',
  };
  const normalized = code(master, 'Normalize inbound job', wrapped);
  const direct = code(master, 'Normalize inbound job', payload);
  for (const key of [
    'source_url', 'source_title', 'publisher', 'published_at', 'source_text', 'source_type',
    'competition', 'teams', 'people', 'requested_by', 'optional_metadata',
  ]) assert.deepEqual(normalized[key], payload[key], `lost webhook field: ${key}`);
  assert.deepEqual(normalized, direct, 'webhook and direct inputs produce equivalent canonical fields');
  for (const key of ['headers', 'query', 'webhookUrl', 'executionMode', 'body']) {
    assert.equal(Object.hasOwn(normalized, key), false, `transport field leaked: ${key}`);
  }

  const intake = read('FF90-01-source-intake');
  const childInput = code(intake, 'Normalize source', normalized);
  assert.equal(childInput.canonical_url, payload.source_url);
  assert.equal(childInput.source_title, payload.source_title);
  assert.equal(childInput.publisher, payload.publisher);
  assert.equal(childInput.published_at, payload.published_at);
  assert.notEqual(childInput.source_id, 'src:6e340b9cffb37a989ca544e6bb780a2c78901d3fb3373876');
});

test('MASTER direct input and malformed or missing nested fields retain safe defaults', () => {
  const master = read('FF90-MASTER');
  const payload = { source_url: 'https://example.invalid/direct', source_title: 'Direct input', published_at: '2026-09-23T00:00:00Z' };
  assert.deepEqual(code(master, 'Normalize inbound job', payload), {
    source_url: payload.source_url,
    source_title: payload.source_title,
    publisher: '',
    published_at: payload.published_at,
    competition: '',
    teams: [],
    people: [],
    source_text: '',
    source_type: 'other',
    requested_by: 'anonymous',
    optional_metadata: {},
  });
  assert.deepEqual(code(master, 'Normalize inbound job', { headers: { ignored: true }, body: [] }), {
    source_url: '', source_title: '', publisher: '', published_at: null, competition: '', teams: [], people: [],
    source_text: '', source_type: 'other', requested_by: 'anonymous', optional_metadata: {},
  });
});

test('FF90-02 retains canonical fields and synthetic content; missing content stays held', () => {
  const w = read('FF90-02-editorial-factory');
  const input = code(w, 'Preserve editorial input', { ...source, run_id: envelope.run_id, editorial_item_id: envelope.editorial_item_id });
  const classified = code(w, 'Classify news type', { run: {}, editorialItem: null }, { 'Preserve editorial input': input });
  const output = code(w, 'Promote FF90-02 output', { ok: true }, { 'Classify news type': classified });
  retained(output, source);
  retained(output, envelope, ['run_id', 'editorial_item_id', 'title_th', 'body_th', 'news_type']);
  assert.equal(output.pipeline_status, 'accepted');
  const empty = { ...input, optional_metadata: {} };
  const held = code(w, 'Classify news type', { editorialItem: null }, { 'Preserve editorial input': empty });
  assert.equal(held.pipeline_status, 'held_for_content');
});

test('FF90-03 NOT_CONFIGURED preserves the editorial envelope through Promote', () => {
  const w = read('FF90-03-image-factory');
  const prompt = code(w, 'Build image prompt', envelope);
  const provider = code(w, 'Provider adapter', prompt);
  assert.equal(provider.provider_status, 'NOT_CONFIGURED');
  const relevant = code(w, 'Visual relevance gate', provider);
  const derivatives = code(w, 'Plan derivatives', relevant);
  const heldAudit = w.nodes.find((node) => node.name === 'Audit log (held)');
  assert.ok(heldAudit);
  assert.match(heldAudit.parameters.jsonBody, /\$json\.run_id/);
  const output = code(w, 'Promote FF90-03 output', { ok: true }, { 'Provider adapter': provider });
  retained(output, envelope, Object.keys(envelope).filter(k => k !== 'pipeline_status'));
  assert.equal(output.provider_status, 'NOT_CONFIGURED');
  assert.equal(output.image_status, 'held');
});

test('FF90-04 accepts text-only input, preserves context, and holds incomplete content', () => {
  const w = read('FF90-04-wordpress-draft');
  const validated = code(w, 'Validate editorial fields', envelope);
  assert.equal(validated.pipeline_status, 'accepted');
  const draft = { wp_post_id: 123, status: 'draft' };
  const meta = code(w, 'Image metadata', draft, { 'Validate editorial fields': validated });
  const output = code(w, 'Promote FF90-04 output', { ok: true }, {
    'Image metadata': meta, 'POST /api/automation/wp-draft': draft,
  });
  retained(output, envelope, Object.keys(envelope).filter(k => k !== 'pipeline_status'));
  assert.equal(output.wp_post_status, 'draft');
  for (const field of ['title_th', 'body_th']) {
    const held = code(w, 'Validate editorial fields', { ...envelope, [field]: ' ' });
    assert.equal(held.pipeline_status, 'held_for_content');
  }
});

test('FF90-05 preserves draft context and no decision remains pending through Promote', () => {
  const w = read('FF90-05-human-review');
  const input = { ...envelope, wp_post_id: 123, wp_post_status: 'draft', publish_mode: 'manual_review' };
  const mode = code(w, 'Resolve publish mode', input);
  const payload = code(w, 'Build notification payload', mode);
  const waiting = code(w, 'Wait for explicit human decision', { ok: true }, { 'Build notification payload': payload });
  const pending = code(w, 'REJECT branch', waiting);
  const output = code(w, 'Promote FF90-05 output', pending);
  retained(output, input, Object.keys(input).filter(k => k !== 'pipeline_status'));
  assert.equal(output.review_status, 'pending');
  assert.equal(output.pipeline_status, 'waiting_human_review');
  assert.equal(output.mode_in_effect, 'manual_review');
  assert.equal(output.auto_pass_after, null);
});
