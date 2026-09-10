// /api/automation/log (FIRST SLICE)
//
// Auth:    x-automation-secret
// Status:  501 NOT IMPLEMENTED. Logs are written directly via
//          AutomationRunRepository from the routes that mutate state
//          (deduplicate / wp-draft). A generic log endpoint is a
//          follow-up slice.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

const Schema = z.object({
  run_id: z.string().uuid().optional(),
  status: z.string().min(1).max(32),
  message: z.string().max(1000).optional(),
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
    { ok: false, error: "not_implemented", note: "log is a follow-up slice" },
    { status: 501 },
  );
}
