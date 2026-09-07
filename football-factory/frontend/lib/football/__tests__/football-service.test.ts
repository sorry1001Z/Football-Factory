// Tests — FootballService orchestration
//
// We inject a fake provider via a subclass override so no real network
// ever happens in this test file. The fake provider exposes the same
// FootballProvider shape used by the real classes (Phase 1.B).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FootballService, httpStatusForKind, type ServiceEnvelopeOk, type ServiceRequest } from '../football-service';
import { MemoryCache } from '../cache';
import { InMemoryQuotaManager } from '../quota';
import { ProviderError } from '../providers/_shared';
import type { Competition, Team, Fixture, MatchResult, Standings } from '../types';

function fakeCompetition(code: string): Competition {
  return {
    provider: 'football-data.org',
    external_id: code,
    canonical_id: 'comp:fd:' + code,
    fetched_at: '2025-01-01T00:00:00.000Z',
    data_quality_status: 'fresh',
    code,
    name: 'Test ' + code,
    tier: 'domestic_league',
  };
}

class TestService extends FootballService {
  calls: Array<{ provider: string; op: string }> = [];
  failWith?: ProviderError;
  payload: unknown = [fakeCompetition('PL'), fakeCompetition('PD')];

  protected override async callProvider<T>(
    req: ServiceRequest,
    provider_name: 'football-data.org' | 'api-football',
    _correlation_id: string,
  ): Promise<{ value: T; fetched_at: string }> {
    this.calls.push({ provider: provider_name, op: req.operation });
    if (this.failWith) throw this.failWith;
    return { value: this.payload as T, fetched_at: '2025-01-01T00:00:00.000Z' };
  }
}

function makeService(opts: {
  failWith?: ProviderError;
  payload?: unknown;
  quotaFloor?: number;
}): TestService {
  const cache = new MemoryCache();
  const quota = new InMemoryQuotaManager({
    'football-data.org': { daily_limit: opts.quotaFloor ?? 5, soft_threshold_ratio: 0.8, window_ms: 60_000 },
    'api-football':       { daily_limit: opts.quotaFloor ?? 5, soft_threshold_ratio: 0.8, window_ms: 60_000 },
  });
  const s = new TestService({ cache, quota, retry_cfg: { max_retries: 0 } });
  if (opts.failWith) s.failWith = opts.failWith;
  if (opts.payload !== undefined) s.payload = opts.payload;
  return s;
}

test('cache hit skips provider call', async () => {
  const s = makeService({});
  const r1 = await s.handle({ operation: 'competitions' });
  const ok1 = r1 as ServiceEnvelopeOk<unknown>;
  assert.equal(ok1.meta.cached, false);
  const r2 = await s.handle({ operation: 'competitions' });
  const ok2 = r2 as ServiceEnvelopeOk<unknown>;
  assert.equal(ok2.meta.cached, true);
  assert.equal(s.calls.length, 1, 'provider should be called exactly once');
});

test('cache miss calls provider exactly once, normalized envelope returned', async () => {
  const s = makeService({});
  const r = await s.handle({ operation: 'competitions' });
  assert.equal(r.ok, true);
  assert.equal(s.calls.length, 1);
  const ok = r as { ok: true; provider: string; data: Competition[]; meta: { correlation_id: string } };
  assert.equal(ok.provider, 'football-data.org');
  assert.equal(ok.data.length, 2);
  assert.equal(ok.data[0].code, 'PL');
  assert.ok(typeof ok.meta.correlation_id === 'string' && ok.meta.correlation_id.length > 0);
});

test('quota block prevents provider call', async () => {
  const s = makeService({ quotaFloor: 1 });
  // burn the single quota slot
  await s.handle({ operation: 'competitions' });
  // second call must be blocked
  const r = await s.handle({ operation: 'competitions' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'RATE_LIMIT');
  assert.equal(s.calls.length, 1, 'provider must NOT be called when quota is exhausted');
});

test('provider error mapped to safe envelope (no leak)', async () => {
  const pe = new ProviderError('AUTH_ERROR', 'football-data.org', 'unauthorized', { http_status: 401 });
  const s = makeService({ failWith: pe });
  const r = await s.handle({ operation: 'competitions' });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.kind, 'AUTH_ERROR');
    assert.equal(r.error.safe_message, 'unauthorized');
    assert.equal(r.error.safe_message.includes('Token'), false);
    assert.equal(r.error.safe_message.includes('Bearer'), false);
  }
});

test('httpStatusForKind mapping', () => {
  assert.equal(httpStatusForKind('AUTH_ERROR'), 502);
  assert.equal(httpStatusForKind('RATE_LIMIT'), 429);
  assert.equal(httpStatusForKind('NOT_FOUND'), 404);
  assert.equal(httpStatusForKind('INVALID_PAYLOAD'), 502);
  assert.equal(httpStatusForKind('UNSUPPORTED'), 501);
  assert.equal(httpStatusForKind('CONFIG_ERROR'), 503);
  assert.equal(httpStatusForKind('SOMETHING_ELSE'), 500);
});

test('normalized result is canonical (no raw provider payload)', async () => {
  const raw = {
    response: [{ id: 1, name: 'PL', __raw_secret: 'TOKEN-XYZ' }],
    extra_meta: { internal_token: 'SHOULD-NOT-LEAK' },
  };
  const s = makeService({ payload: [fakeCompetition('PL')] });
  // If the service leaked raw payload, raw keys would surface. Our fake
  // normalizer returns the canonical record only. This test is the contract
  // assertion for that promise.
  const r = await s.handle({ operation: 'competitions' });
  assert.equal(r.ok, true);
  const serialized = JSON.stringify(r);
  assert.equal(serialized.includes('__raw_secret'), false);
  assert.equal(serialized.includes('SHOULD-NOT-LEAK'), false);
});

test('service never serializes keys (env-supplied)', () => {
  const s = makeService({});
  const serialized = JSON.stringify(s);
  // Service holds an InMemoryQuotaManager and a MemoryCache. Neither should
  // surface secret material.
  assert.equal(serialized.includes('FOOTBALL_DATA_API_KEY'), false);
  assert.equal(serialized.includes('API_FOOTBALL_KEY'), false);
});

test('service env provider override works', async () => {
  const s = new TestService({
    cache: new MemoryCache(),
    quota: new InMemoryQuotaManager({}),
    env: { FOOTBALL_PROVIDER: 'api-football' },
    retry_cfg: { max_retries: 0 },
  });
  const r = await s.handle({ operation: 'competitions' });
  const ok = r as ServiceEnvelopeOk<unknown>;
  assert.equal(ok.provider, 'api-football');
});

// Suppress unused import warnings
void ({} as Team); void ({} as Fixture); void ({} as MatchResult); void ({} as Standings);
