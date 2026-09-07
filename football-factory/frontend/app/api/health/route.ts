// GET /api/health
// Machine-readable health probe.
//
// Rules:
//   - Never return secret values, never echo tokens.
//   - Only indicate configured / not configured.
//   - 200 even when optional external providers are unconfigured.
//   - No external API calls in Phase 0.C.

import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

function bool(v: string | undefined): boolean {
  return typeof v === 'string' && v.length > 0 && v !== 'replace-with-a-long-random-secret';
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function GET() {
  const checks = {
    frontend: 'ok' as const,
    wordpress_configured: bool(process.env.WORDPRESS_GRAPHQL_URL),
    football_data_configured: bool(process.env.FOOTBALL_DATA_API_KEY),
    api_football_configured: bool(process.env.API_FOOTBALL_KEY),
  };

  return NextResponse.json(
    {
      status: 'ok',
      service: 'football-factory-frontend',
      version: readVersion(),
      checks,
    },
    { status: 200 }
  );
}
