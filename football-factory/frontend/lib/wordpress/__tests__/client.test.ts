// Tests — WordPress client (server-only). Uses fetch injection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WordPressClient, WordPressClientError } from '../client';

function makeFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return (async (url: string, init?: RequestInit) => impl(url, init)) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('unconfigured client: throws UNCONFIGURED', async () => {
  const c = new WordPressClient({ endpoint: '' });
  assert.equal(c.configured, false);
  await assert.rejects(
    () => c.request({ query: '{ __typename }' }),
    (err: unknown) => err instanceof WordPressClientError && err.kind === 'UNCONFIGURED',
  );
});

test('endpoint_host returns host portion only', () => {
  const c = new WordPressClient({ endpoint: 'https://example.com/graphql?token=abc' });
  assert.equal(c.endpoint_host, 'example.com');
});

test('endpoint_host returns null for invalid endpoint', () => {
  const c = new WordPressClient({ endpoint: 'not-a-url' });
  assert.equal(c.endpoint_host, null);
});

test('GraphQL error response: throws GRAPHQL_ERROR', async () => {
  const c = new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: makeFetch(async () => jsonResponse({ errors: [{ message: 'Boom' }] })),
  });
  await assert.rejects(
    () => c.request({ query: '{ __typename }' }),
    (err: unknown) => err instanceof WordPressClientError && err.kind === 'GRAPHQL_ERROR',
  );
});

test('HTTP error: throws HTTP_ERROR with status', async () => {
  const c = new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: makeFetch(async () => jsonResponse({}, 500)),
  });
  await assert.rejects(
    () => c.request({ query: '{ __typename }' }),
    (err: unknown) => err instanceof WordPressClientError &&
      err.kind === 'HTTP_ERROR' && err.http_status === 500,
  );
});

test('invalid JSON: throws INVALID_PAYLOAD', async () => {
  const c = new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: makeFetch(async () => new Response('not json', { status: 200 })),
  });
  await assert.rejects(
    () => c.request({ query: '{ __typename }' }),
    (err: unknown) => err instanceof WordPressClientError && err.kind === 'INVALID_PAYLOAD',
  );
});

test('valid response: returns data', async () => {
  const c = new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: makeFetch(async () => jsonResponse({ data: { ok: true } })),
  });
  const data = await c.request<{ ok: boolean }>({ query: '{ ok }' });
  assert.equal(data.ok, true);
});

test('empty query: throws INVALID_PAYLOAD', async () => {
  const c = new WordPressClient({
    endpoint: 'https://example.com/graphql',
    fetchImpl: makeFetch(async () => jsonResponse({ data: {} })),
  });
  await assert.rejects(
    () => c.request({ query: '' }),
    (err: unknown) => err instanceof WordPressClientError && err.kind === 'INVALID_PAYLOAD',
  );
});

test('toJSON does not echo the endpoint URL with token', () => {
  // Endpoint itself is not a secret (it is just the GraphQL URL).
  // A query-string token appended to the endpoint IS a secret and must
  // never appear in toJSON(). The redaction contract is:
  //   - endpoint without secrets: may remain (operationally useful)
  //   - any token / credential in endpoint or other fields: must be absent
  const c = new WordPressClient({ endpoint: 'https://example.com/graphql?token=SECRET_AUTH_TOKEN' });
  const s = JSON.stringify(c);
  // Sensitive token MUST NOT appear.
  assert.equal(s.includes('SECRET_AUTH_TOKEN'), false, 'token leaked into toJSON()');
  // Generic credential-shaped substrings (Bearer, Authorization) MUST NOT appear.
  assert.equal(/bearer\s+\S+/i.test(s), false, 'bearer token leaked into toJSON()');
  assert.equal(/authorization/i.test(s), false, 'authorization header leaked into toJSON()');
  // Endpoint itself is allowed to remain (no secret in it).
  assert.equal(s.includes('example.com'), true, 'endpoint was unexpectedly stripped');
});
