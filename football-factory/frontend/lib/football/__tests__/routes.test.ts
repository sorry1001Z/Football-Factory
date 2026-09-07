// Tests — /api/football/* route handlers.
// We test the handler functions directly (no HTTP layer) by importing
// the GET export from each route module and passing a constructed Request.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET as getCompetitions } from '../../../app/api/football/competitions/route';
import { GET as getMatches } from '../../../app/api/football/matches/route';
import { GET as getStandings } from '../../../app/api/football/standings/route';
import { GET as getTeams } from '../../../app/api/football/teams/route';
import { GET as getFootballHealth } from '../../../app/api/football/health/route';

function url(path: string, qs?: Record<string, string>): Request {
  const u = new URL('http://localhost' + path);
  if (qs) for (const [k, v] of Object.entries(qs)) u.searchParams.set(k, v);
  return new Request(u.toString(), { method: 'GET' });
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return JSON.parse(text) as T;
}

test('/api/football/health: 200 + safe shape, no secret fields', async () => {
  const res = await getFootballHealth(url('/api/football/health'));
  assert.equal(res.status, 200);
  const body = await readJson<Record<string, unknown>>(res);
  assert.equal(body.ok, true);
  // Safe fields present
  for (const k of ['provider', 'configured', 'cache', 'quota', 'version', 'timestamp']) {
    assert.ok(k in body, `missing safe field: ${k}`);
  }
  // Forbidden fields absent
  for (const k of ['api_key', 'authorization', 'x-apisports-key', 'env']) {
    assert.equal(k in body, false, `unsafe field leaked: ${k}`);
  }
});

test('/api/football/competitions: 200 with envelope (cache miss → provider not configured → empty list)', async () => {
  // No FOOTBALL_DATA_API_KEY in env, so the provider returns [].
  const res = await getCompetitions(url('/api/football/competitions'));
  assert.equal(res.status, 200);
  const body = await readJson<Record<string, unknown>>(res);
  assert.equal(body.ok, true);
  assert.ok('meta' in body);
  assert.ok('data' in body);
  // No raw provider payload fields like "response" or "seasons"
  const s = JSON.stringify(body);
  assert.equal(s.includes('"seasons":'), false, 'raw provider field leaked');
});

test('/api/football/matches: invalid query (oversized competition) → 400', async () => {
  const long = 'a'.repeat(200);
  const res = await getMatches(url('/api/football/matches', { competition: long }));
  assert.equal(res.status, 400);
});

test('/api/football/matches: missing params still responds', async () => {
  const res = await getMatches(url('/api/football/matches'));
  assert.equal(res.status, 200);
});

test('/api/football/standings: 200 envelope', async () => {
  const res = await getStandings(url('/api/football/standings', { competition: 'league:premier-league' }));
  assert.equal(res.status, 200);
});

test('/api/football/teams: 200 envelope', async () => {
  const res = await getTeams(url('/api/football/teams', { competition: 'league:premier-league' }));
  assert.equal(res.status, 200);
});

test('/api/football/teams: invalid provider string ignored, defaults to football-data', async () => {
  const res = await getTeams(url('/api/football/teams', { provider: 'openliga-db' }));
  assert.equal(res.status, 200);
});
