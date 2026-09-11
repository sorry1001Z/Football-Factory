// /api/automation/wp-publish (FIRST SLICE / 003)
//
// Auth:    x-automation-secret
// Body:    { run_id, wp_post_id }
//
// Behavior:
//   1. Authenticate AUTOMATION_SECRET.
//   2. Validate body.
//   3. Find run by run_id (404 if missing).
//   4. Resolve editorial item deterministically via
//      automation_runs.editorial_item_id (added in migration 003).
//      If NULL → 409 editorial_link_missing.
//   5. Verify editorial_item.wp_post_id == input.wp_post_id. If not →
//      409 wp_post_mismatch.
//   6. Require editorial_item.approval_state == 'approved'. If not →
//      409 approval_not_granted (with the actual state in the body).
//   7. If automation_runs.status == 'success' for this run, return
//      cached state (idempotent retry).
//   8. Call WordPressWriteClient.updatePost(id, { status: 'publish' }).
//      On WP 4xx → 400 wp_<kind>. On WP timeout/network → 502.
//   9. Set automation_runs.status = 'success'.
//  10. Return the published post + the run id.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import {
  WordPressWriteError,
} from "@/lib/wordpress/write";
import { getWordPressWriteClient } from "@/lib/wordpress/__test-hooks__/write";

export const dynamic = "force-dynamic";

const Schema = z.object({
  run_id: z.string().uuid(),
  wp_post_id: z.number().int().positive(),
});

function conflict(error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...(extra ?? {}) }, { status: 409 });
}

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

  const { run_id, wp_post_id } = v.data;

  const db = getDb();
  const runs = new AutomationRunRepository(db);
  const run = await runs.get(run_id);
  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
  }

  // Idempotency: if this run already succeeded, return cached state.
  if (run.status === "success") {
    const out = (run.output ?? {}) as { wp_post_id?: number };
    return NextResponse.json(
      {
        ok: true,
        run_id,
        wp_post_id: out.wp_post_id ?? wp_post_id,
        status: "publish",
        idempotent: true,
        note: "run already succeeded; returning cached state",
      },
      { status: 200 },
    );
  }

  // Resolve editorial item deterministically.
  const editorial = new EditorialRepository(db);
  const item = await editorial.findByRunId(run_id);
  if (!item) {
    await runs.setStatus(run_id, "failed", undefined, "editorial_link_missing");
    return conflict("editorial_link_missing", {
      reason: "automation_runs.editorial_item_id is NULL; cannot publish without an approved editorial item",
    });
  }
  if (item.wp_post_id === null || item.wp_post_id !== wp_post_id) {
    await runs.setStatus(run_id, "failed", undefined, "wp_post_mismatch");
    return conflict("wp_post_mismatch", {
      editorial_item_id: item.id,
      editorial_wp_post_id: item.wp_post_id,
      request_wp_post_id: wp_post_id,
    });
  }
  if (item.approval_state !== "approved") {
    await runs.setStatus(run_id, "failed", undefined, "approval_not_granted");
    return conflict("approval_not_granted", {
      approval_state: item.approval_state,
      editorial_item_id: item.id,
    });
  }

  const wp = getWordPressWriteClient();
  if (!wp.configured) {
    await runs.setStatus(run_id, "failed", undefined, "wp_write_not_configured");
    return NextResponse.json(
      { ok: false, error: "wp_write_not_configured" },
      { status: 503 },
    );
  }

  try {
    const post = await wp.updatePost(wp_post_id, { status: "publish" });
    await runs.setStatus(run_id, "success", { wp_post_id, wp_status: post.status });
    return NextResponse.json(
      {
        ok: true,
        run_id,
        wp_post_id,
        status: post.status,
        editorial_item_id: item.id,
      },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof WordPressWriteError) {
      const msg = e.kind; // timeout | network | http_4xx | http_5xx | invalid_json | not_configured
      await runs.setStatus(run_id, "failed", undefined, msg);
      const status = e.kind === "http_4xx" ? 400 : 502;
      return NextResponse.json(
        { ok: false, error: msg, status: e.status ?? null },
        { status },
      );
    }
    throw e;
  }
}
