// Tests — Retry policy

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retry, DEFAULT_RETRY } from '../retry';
import { ProviderError } from '../providers/_shared';

function err(kind: 'RATE_LIMIT' | 'AUTH_ERROR' | 'NOT_FOUND' | 'HTTP_ERROR' | 'INVALID_PAYLOAD',
            status?: number): ProviderError {
  return new ProviderError(kind, 'football-data.org', `${kind} ${status ?? ''}`, { http_status: status });
}

const no_sleep = async () => {};

test('retry succeeds on first attempt', async () => {
  let calls = 0;
  const out = await retry(async () => { calls++; return 'ok'; }, { max_retries: 2 }, { sleep: no_sleep });
  assert.equal(out, 'ok');
  assert.equal(calls, 1);
});

test('retry succeeds after 429 then success', async () => {
  let calls = 0;
  const out = await retry(async () => {
    calls++;
    if (calls < 2) throw err('RATE_LIMIT', 429);
    return 'ok';
  }, { max_retries: 2, initial_backoff_ms: 1 }, { sleep: no_sleep });
  assert.equal(out, 'ok');
  assert.equal(calls, 2);
});

test('retry succeeds after 500 then success', async () => {
  let calls = 0;
  const out = await retry(async () => {
    calls++;
    if (calls < 2) throw err('HTTP_ERROR', 503);
    return 'ok';
  }, { max_retries: 2, initial_backoff_ms: 1 }, { sleep: no_sleep });
  assert.equal(out, 'ok');
});

test('retry stops after max_retries on persistent 429', async () => {
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('RATE_LIMIT', 429);
    }, { max_retries: 2, initial_backoff_ms: 1 }, { sleep: no_sleep }),
    (e: unknown) => e instanceof ProviderError && e.kind === 'RATE_LIMIT',
  );
  // 1 initial + 2 retries = 3
  assert.equal(calls, 3);
});

test('retry does NOT retry on 401', async () => {
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('AUTH_ERROR', 401);
    }, { max_retries: 5, initial_backoff_ms: 1 }, { sleep: no_sleep }),
    (e: unknown) => e instanceof ProviderError && e.kind === 'AUTH_ERROR',
  );
  assert.equal(calls, 1);
});

test('retry does NOT retry on 404', async () => {
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('NOT_FOUND', 404);
    }, { max_retries: 5, initial_backoff_ms: 1 }, { sleep: no_sleep }),
    (e: unknown) => e instanceof ProviderError && e.kind === 'NOT_FOUND',
  );
  assert.equal(calls, 1);
});

test('retry does NOT retry on invalid_payload', async () => {
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('INVALID_PAYLOAD');
    }, { max_retries: 5, initial_backoff_ms: 1 }, { sleep: no_sleep }),
    (e: unknown) => e instanceof ProviderError && e.kind === 'INVALID_PAYLOAD',
  );
  assert.equal(calls, 1);
});

test('retry does NOT retry on 4xx HTTP_ERROR (e.g. 400)', async () => {
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('HTTP_ERROR', 400);
    }, { max_retries: 5, initial_backoff_ms: 1 }, { sleep: no_sleep }),
    (e: unknown) => e instanceof ProviderError,
  );
  assert.equal(calls, 1);
});

test('retry DOES retry on 5xx HTTP_ERROR (e.g. 503)', async () => {
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('HTTP_ERROR', 503);
    }, { max_retries: 2, initial_backoff_ms: 1 }, { sleep: no_sleep }),
    (e: unknown) => e instanceof ProviderError,
  );
  assert.equal(calls, 3); // 1 initial + 2 retries
});

test('retry max_retries=0 → single attempt', async () => {
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('RATE_LIMIT', 429);
    }, { max_retries: 0 }, { sleep: no_sleep }),
  );
  assert.equal(calls, 1);
});

test('DEFAULT_RETRY sensible defaults', () => {
  assert.equal(DEFAULT_RETRY.max_retries, 2);
  assert.ok(DEFAULT_RETRY.initial_backoff_ms > 0);
  assert.ok(DEFAULT_RETRY.max_backoff_ms >= DEFAULT_RETRY.initial_backoff_ms);
});

test('retry: sleep failure stops retries, throws last fn error', async () => {
  // Even with an exploding sleep, retry must propagate the last error
  // from fn, not the sleep error. A sleep failure aborts the retry loop
  // immediately and rethrows the most recent fn error.
  let calls = 0;
  await assert.rejects(
    async () => retry(async () => {
      calls++;
      throw err('RATE_LIMIT', 429);
    }, { max_retries: 1 }, { sleep: async () => { throw new Error('sleep exploded'); } }),
    (e: unknown) => e instanceof ProviderError,
  );
  // Only the initial attempt completed; the retry was skipped because
  // sleep threw before the retry's fn() could run.
  assert.equal(calls, 1);
});
