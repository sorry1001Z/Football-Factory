import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { getDb } from "@/lib/db/postgres";
import { assertAutomationEnabled, automationDisabledResponse } from "@/lib/automation/kill-switch";
import { AUTOMATION_SECRET_HEADER } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

const Schema = z.object({ recovery_id: z.string().uuid() }).strict();
const Params = z.object({ runId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const auth = requireAdminOrEditor(request);
  const denied = guardResponse(auth);
  if (denied) return denied;
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);
  const killSwitch = assertAutomationEnabled();
  if (!killSwitch.ok) return automationDisabledResponse();

  const parsedParams = Params.safeParse(await context.params);
  if (!parsedParams.success) return NextResponse.json({ ok: false, error: "invalid_run_id" }, { status: 400 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const body = Schema.safeParse(raw);
  if (!body.success) return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });

  const configuredUrl = process.env.N8N_WEBHOOK_URL;
  if (!configuredUrl) return NextResponse.json({ ok: false, error: "master_webhook_not_configured", recovery_queued: true }, { status: 503 });
  const automationSecret = process.env.AUTOMATION_SECRET;
  if (typeof automationSecret !== "string" || automationSecret.length < 16 || /(CHANGE_ME|example\.com|replace-with)/i.test(automationSecret)) {
    return NextResponse.json({ ok: false, error: "automation_secret_not_configured", recovery_queued: true }, { status: 503 });
  }
  let webhookUrl: URL;
  try {
    webhookUrl = new URL(configuredUrl);
    if (webhookUrl.protocol !== "https:" || webhookUrl.username || webhookUrl.password) throw new Error("invalid_webhook_url");
  } catch {
    return NextResponse.json({ ok: false, error: "master_webhook_configuration_invalid", recovery_queued: true }, { status: 503 });
  }

  const db = getDb();
  const queued = await db.query<{ id: string }>(
    `SELECT recovery.id FROM automation_run_recoveries recovery
       JOIN automation_runs run ON run.id = recovery.run_id
      WHERE recovery.id = $1 AND recovery.run_id = $2
        AND recovery.status = 'queued' AND recovery.available_at <= now()
        AND run.status = 'recovery_queued'`,
    [body.data.recovery_id, parsedParams.data.runId],
  );
  if (!queued.rows[0]) return NextResponse.json({ ok: false, error: "recovery_not_dispatchable" }, { status: 409 });

  await db.query(
    `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'run_recovery_dispatch_requested', 'automation_run', $2, $3::jsonb)`,
    [auth.ok ? auth.session.userId : null, parsedParams.data.runId, JSON.stringify({ recovery_id: body.data.recovery_id })],
  );
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [AUTOMATION_SECRET_HEADER]: automationSecret,
      },
      body: JSON.stringify({ recovery_id: body.data.recovery_id }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("master_webhook_rejected");
  } catch {
    await db.query(
      `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'run_recovery_dispatch_failed', 'automation_run', $2, $3::jsonb)`,
      [auth.ok ? auth.session.userId : null, parsedParams.data.runId, JSON.stringify({ recovery_id: body.data.recovery_id })],
    );
    return NextResponse.json({ ok: false, error: "master_webhook_unavailable", recovery_queued: true, recovery_id: body.data.recovery_id }, { status: 502 });
  }
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'run_recovery_dispatch_accepted', 'automation_run', $2, $3::jsonb)`,
    [auth.ok ? auth.session.userId : null, parsedParams.data.runId, JSON.stringify({ recovery_id: body.data.recovery_id })],
  );
  return NextResponse.json({ ok: true, dispatched: true, recovery_id: body.data.recovery_id, run_id: parsedParams.data.runId }, { status: 202, headers: { "cache-control": "no-store" } });
}
