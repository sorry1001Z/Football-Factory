// /api/automation/approval-status (FIRST SLICE)
//
// Auth:    x-automation-secret
// Status:  501 NOT IMPLEMENTED in this slice.
//
// The human-approval workflow lives in a follow-up slice. This endpoint
// MUST still authenticate (so we don't expose the endpoint shape to
// unauthenticated callers) and MUST validate the body shape, but
// returns 501 to indicate the feature is not yet implemented.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

const Schema = z.object({
  run_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const a = verifyAutomationSecret(request);
  if (!a.ok) return authRejectResponse(a);

  const body = await readCappedBody(request, "automation");
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, error: body.reason === "too_large" ? "body_too_large" : "body_invalid" },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const v = Schema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }
  return NextResponse.json(
    {
      ok: false,
      error: "not_implemented",
      note: "approval-status is a follow-up slice; do not activate n8n until this is wired",
    },
    { status: 501 },
  );
}
