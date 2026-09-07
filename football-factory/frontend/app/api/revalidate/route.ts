import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-ff-revalidate-secret');
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const paths = Array.isArray(body.paths) ? body.paths.filter((p: unknown) => typeof p === 'string' && p.startsWith('/')) : ['/'];
  for (const path of paths.slice(0, 25)) revalidatePath(path);
  return NextResponse.json({ ok: true, revalidated: paths.slice(0, 25), at: new Date().toISOString() });
}
