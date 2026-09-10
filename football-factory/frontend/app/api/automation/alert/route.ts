// /api/automation/alert (FIRST SLICE)
//
// Auth:    x-automation-secret
// Status:  501 NOT IMPLEMENTED. Telegram alerts are a follow-up slice.
//          This endpoint is reserved so the n8n Alert node has a
//          production-shape target during staging tests, but it does
//          NOT forward alerts to Telegram yet.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

const Schema = z.object({
  severity: z.enum(["info", "warning", "error", "critical"]),
  source: z.string().min(1).max(64),
  message: z.string().min(1).max(1000),
  context: z.record(z.string(), z.unknown()).optional(),
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
    { ok: false, error: "not_implemented", note: "alert is a follow-up slice" },
    { status: 501 },
  );
}
