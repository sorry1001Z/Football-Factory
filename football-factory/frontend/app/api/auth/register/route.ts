// POST /api/auth/register
//
// Body: { email, password, display_name }
// Returns: 201 { user: {id,email,display_name,role} } + sets cookie
//
// Security:
//   - zod validation
//   - body size cap (64 KB)
//   - rate limit: 3 per hour per IP
//   - generic error message (does NOT reveal whether email exists)
//   - on success, sets ff_session cookie with HttpOnly/Secure/SameSite=Lax

import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { consume, ipOf } from "@/lib/security/rate-limit";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { buildSessionCookie } from "@/lib/auth/cookie";
import { getAuthService, authUnavailableResponse } from "@/lib/auth/route-helper";
import { AuthError } from "@/lib/auth/auth-service";

export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(256),
  display_name: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  // CSRF
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  // Body cap
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
  const v = RegisterSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }

  // Rate limit
  const rl = consume(`register:${ipOf(request)}`, 3, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", reset_ms: rl.reset_ms },
      { status: 429 },
    );
  }

  // Auth service
  const svcRes = getAuthService();
  if (!svcRes.ok) return authUnavailableResponse(svcRes);
  let user;
  try {
    user = await svcRes.service.register({
      email: v.data.email,
      password: v.data.password,
      displayName: v.data.display_name,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      // Generic error: do not reveal whether the email exists.
      return NextResponse.json(
        { ok: false, error: "registration_failed" },
        { status: 400 },
      );
    }
    throw e;
  }

  // Auto-login on register (so the user lands logged in).
  const login = await svcRes.service.login(v.data.email, v.data.password);
  const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
  const cookie = buildSessionCookie(login.token, ttl);
  const res = NextResponse.json(
    {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
      },
    },
    { status: 201 },
  );
  res.headers.append("set-cookie", cookie);
  return res;
}
