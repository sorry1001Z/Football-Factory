// /api/automation/alert (FIRST SLICE / 003)
//
// Auth:    x-automation-secret
// Body:    { severity, source, message, context?, run_id? }
//
// Behavior:
//   - Authenticate AUTOMATION_SECRET.
//   - Validate body (severity enum: info/warning/error/critical).
//   - Persist into the existing analytics_events table with
//     event_name='automation_alert'. Severity, message, context, and
//     run_id live in properties.
//   - No external delivery (Telegram/Slack/Email). Persistence only.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import { getDb } from "@/lib/db/postgres";
import { AlertRepository } from "@/lib/auth/alert-repository";
import { redactSecrets } from "@/lib/auth/redact-secrets";

export const dynamic = "force-dynamic";

const Schema = z.object({
  severity: z.enum(["info", "warning", "error", "critical"]),
  source: z.string().min(1).max(64),
  message: z.string().min(1).max(2000),
  context: z.record(z.string(), z.unknown()).optional(),
  run_id: z.string().uuid().optional(),
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

  // Scrub secrets in context before persistence.
  const safeContext = redactSecrets(v.data.context ?? {});

  const repo = new AlertRepository(getDb());
  const inserted = await repo.insert({
    severity: v.data.severity,
    source: v.data.source,
    message: v.data.message,
    context: safeContext,
    run_id: v.data.run_id ?? null,
  });

  return NextResponse.json(
    { ok: true, id: inserted.id },
    { status: 200 },
  );
}
