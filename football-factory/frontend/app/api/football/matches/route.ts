// GET /api/football/matches?competition=premier-league&season=2024

import { NextResponse } from 'next/server';
import { getBoot } from '../_boot';
import { httpStatusForKind, type ServiceEnvelope } from '@/lib/football/football-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { service } = getBoot();
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') ?? undefined;
  const competition = url.searchParams.get('competition');
  const season = url.searchParams.get('season');

  if (competition !== null && competition.length > 64) {
    const envelope: ServiceEnvelope<unknown> = {
      ok: false,
      error: { kind: 'INVALID_QUERY', safe_message: 'competition too long', provider: null },
      meta: { correlation_id: `r-${Date.now().toString(36)}` },
    };
    return NextResponse.json(envelope, { status: 400 });
  }

  const envelope: ServiceEnvelope<unknown> = await service.handle({
    operation: 'matches',
    provider: (provider === 'football-data.org' || provider === 'api-football') ? provider : undefined,
    params: {
      competition_canonical_id: competition ?? undefined,
      season_canonical_id: season ?? undefined,
    },
  });

  if (!envelope.ok) {
    return NextResponse.json(envelope, { status: httpStatusForKind(envelope.error.kind) });
  }
  return NextResponse.json(envelope, { status: 200 });
}
