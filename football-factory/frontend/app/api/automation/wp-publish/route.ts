// /api/automation/wp-publish (FIRST SLICE)
//
// Auth:    x-automation-secret
// Status:  501 NOT IMPLEMENTED. This slice MUST NOT enable automated
//          publishing — every approval gate must be human-reviewed.
//
// Auth + body validation only.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

const Schema = z.object({
  run_id: z.string().uuid(),
  wp_post_id: z.number().int().positive(),
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
      note: "wp-publish requires a human-approval gate before activation; do NOT enable until approval-status is wired",
    },
    { status: 501 },
  );
}
