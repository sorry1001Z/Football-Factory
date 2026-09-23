// /api/automation/log (FIRST SLICE / 003)
//
// Auth:    x-automation-secret
// Body:    { run_id?, event_type, stage, status, message?, metadata? }
// Status:  success | held_for_human (FF90 audit event contract).
//
// Behavior:
//   - Authenticate AUTOMATION_SECRET.
//   - Validate body.
//   - Apply recursive secret-redaction to metadata (and to message if
//     it is a structured object).
//   - Persist into the existing audit_logs table.
//   - Never persist the Authorization header, session token, or any
//     field whose key matches a sensitive pattern.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import {
  assertAutomationEnabled,
  automationDisabledResponse,
} from "@/lib/automation/kill-switch";
import {
  AUTOMATION_RL,
  consumeAutomationRateLimit,
  rateLimitedResponse,
} from "@/lib/automation/rate-limit-helpers";

import { getDb } from "@/lib/db/postgres";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";
import { redactSecrets } from "@/lib/auth/redact-secrets";

export const dynamic = "force-dynamic";

const STATUSES = ["success", "held_for_human"] as const;

const Schema = z.object({
  run_id: z.string().uuid().optional(),
  event_type: z.string().min(1).max(64),
  stage: z.string().min(1).max(64),
  status: z.enum(STATUSES),
  message: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const a = verifyAutomationSecret(request);
  if (!a.ok) return authRejectResponse(a);

  // Step 2: kill-switch check. Fail-closed when AUTOMATION_ENABLED != "true".
  const ks = assertAutomationEnabled();
  if (!ks.ok) return automationDisabledResponse();

  // Step 3: per-instance rate limit (log per route config).
  const rl = consumeAutomationRateLimit(request, AUTOMATION_RL.log);
  if (!rl.ok) return rateLimitedResponse(rl.resetMs);

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

  // Recursive secret-redaction. Even if a malicious caller nests
  // Authorization/password/token fields deep inside metadata, they
  // are stripped before insert.
  const safeMetadata = redactSecrets(v.data.metadata ?? {});

  const repo = new AutomationLogRepository(getDb());
  const inserted = await repo.insert({
    run_id: v.data.run_id ?? null,
    action: v.data.event_type,
    stage: v.data.stage,
    status: v.data.status,
    message: v.data.message ?? null,
    metadata: safeMetadata,
    request_id: null,
    ip_hash: null,
  });

  return NextResponse.json(
    { ok: true, id: inserted.id },
    { status: 200 },
  );
}
