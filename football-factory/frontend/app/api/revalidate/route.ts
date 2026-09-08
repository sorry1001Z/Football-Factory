// Football Factory — /api/revalidate (Phase 2 hardened)
// Accepts WordPress publish/update/delete webhooks. Reuses the same
// REVALIDATE_SECRET contract. Path allowlist prevents arbitrary URL
// revalidation. Constant-time header comparison.

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  constantTimeEquals,
  sanitizeRevalidatePaths,
} from "@/lib/revalidation/revalidation";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ff-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET ||
      !constantTimeEquals(secret ?? null, process.env.REVALIDATE_SECRET ?? null)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const paths = Array.isArray(body?.paths) ? body.paths : ["/"];
  const result = sanitizeRevalidatePaths(paths);

  for (const path of result.revalidated) {
    revalidatePath(path);
  }
  return NextResponse.json({
    ok: true,
    revalidated: result.revalidated,
    rejected: result.rejected,
    at: result.at,
  });
}
