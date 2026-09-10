// POST /api/auth/logout
//
// Clears the session cookie. Always 200 (logout is idempotent).
// No CSRF check required because logout is non-destructive; if a third
// party triggers logout, the worst they do is clear a valid cookie.

import { NextResponse } from "next/server";
import { buildClearCookie } from "@/lib/auth/cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.append("set-cookie", buildClearCookie());
  return res;
}
