// GET /api/football/health
// Safe diagnostic endpoint. MUST NOT make real external API calls in
// Phase 1.C. Returns configured booleans only — never secret values.

import { NextResponse } from 'next/server';
import { getBoot } from '../_boot';

export const dynamic = 'force-dynamic';

function bool(v: string | undefined): boolean {
  return typeof v === 'string' && v.length > 0 && v !== 'replace-with-a-long-random-secret';
}

export async function GET(request: Request): Promise<NextResponse> {
  const { quota } = getBoot();
  const url = new URL(request.url);
  const requested = url.searchParams.get('provider') ?? 'football-data.org';
  const provider_name: 'football-data.org' | 'api-football' =
    requested === 'api-football' ? 'api-football' : 'football-data.org';

  const snap = quota.snapshot(provider_name);
  const body = {
    ok: true,
    service: 'football-factory-football',
    provider: provider_name,
    configured:
      provider_name === 'football-data.org'
        ? bool(process.env.FOOTBALL_DATA_API_KEY)
        : bool(process.env.API_FOOTBALL_KEY),
    cache: 'memory',
    quota: {
      enabled: true,
      requests_in_window: snap.requests_in_window,
      daily_limit: snap.daily_limit,
      status: snap.status,
    },
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: 200 });
}
