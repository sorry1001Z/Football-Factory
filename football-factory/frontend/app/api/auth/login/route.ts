// POST /api/auth/login
//
// Body: { email, password }
// Returns: 200 { user: {...} } + sets cookie
//
// Security:
//   - zod validation
//   - body cap 64 KB
//   - rate limit: 5 / minute / IP
//   - generic "invalid_credentials" error (no enumeration)
//   - sets secure cookie on success

import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { consume, ipOf } from "@/lib/security/rate-limit";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { buildSessionCookie } from "@/lib/auth/cookie";
import { getAuthService, authUnavailableResponse } from "@/lib/auth/route-helper";
import { AuthError } from "@/lib/auth/auth-service";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  // CSRF
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  // Body
  const body = await readCappedBody(request, "auth");
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, error: body.reason === "too_large" ? "body_too_large" : "body_invalid" },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  if (!body.raw) {
    return NextResponse.json({ ok: false, error: "empty_body" }, { status: 400 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const v = LoginSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }

  // Rate limit
  const rl = consume(`login:${ipOf(request)}`, 5, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", reset_ms: rl.reset_ms },
      { status: 429 },
    );
  }

  const svcRes = getAuthService();
  if (!svcRes.ok) return authUnavailableResponse(svcRes);

  let login;
  try {
    login = await svcRes.service.login(v.data.email, v.data.password);
  } catch (e) {
    if (e instanceof AuthError) {
      // Single generic message. Constant response time approximation:
      // we do not include any timing-leaking detail.
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 },
      );
    }
    throw e;
  }

  const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
  const cookie = buildSessionCookie(login.token, ttl);
  const res = NextResponse.json(
    {
      ok: true,
      user: {
        id: login.user.id,
        email: login.user.email,
        display_name: login.user.display_name,
        role: login.user.role,
      },
    },
    { status: 200 },
  );
  res.headers.append("set-cookie", cookie);
  return res;
}
