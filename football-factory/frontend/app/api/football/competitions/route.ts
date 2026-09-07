// GET /api/football/competitions

import { NextResponse } from 'next/server';
import { getBoot } from '../_boot';
import {
  httpStatusForKind,
  type ServiceEnvelope,
} from '@/lib/football/football-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { service } = getBoot();
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') ?? undefined;

  const envelope: ServiceEnvelope<unknown> = await service.handle({
    operation: 'competitions',
    provider: (provider === 'football-data.org' || provider === 'api-football')
      ? provider
      : undefined,
  });

  if (!envelope.ok) {
    return NextResponse.json(envelope, { status: httpStatusForKind(envelope.error.kind) });
  }
  return NextResponse.json(envelope, { status: 200 });
}
