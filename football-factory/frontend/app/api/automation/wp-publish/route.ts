// /api/automation/wp-publish (FIRST SLICE / 003 + CROSS-ROUTE SAFETY PATCH)
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
//   5. WP draft linkage: the authoritative WP draft id lives on
//      automation_runs.output.wp_post_id (written by wp-draft).
//      The request body wp_post_id is treated ONLY as a cross-check.
//      If run.output.wp_post_id is missing or invalid → 409 run_wp_id_missing.
//      If request.wp_post_id !== run.output.wp_post_id → 409 wp_post_mismatch.
//   6. HARD GATES (all required for publish):
//        a. approval_state == 'approved'            → 409 approval_not_granted
//        b. rights_confirmed == true                → 409 rights_not_cleared
//        c. stage == 'approved'                     → 409 stage_not_approved
//      Each gate is a *recoverable* 409 (we do NOT mark the run as
//      'failed' for rights_not_cleared / stage_not_approved, so the same
//      run can continue after legitimate rights clearance).
//   7. Idempotency: if automation_runs.status == 'success' for this run,
//      return cached state (no duplicate publish, no duplicate WP post).
//      Additionally, if editorial_items.stage == 'published', also
//      return cached state — same published item re-published from n8n.
//   8. Call WordPressWriteClient.updatePost(id, { status: 'publish' }).
//      On WP 4xx → 400 wp_<kind>. On WP timeout/network → 502.
//   9. Set automation_runs.status = 'success'.
//  10. Advance editorial_items.stage to 'published' (terminal) — but only
//      after the WP call succeeds, so a transient WP failure does not
//      prematurely mark the item as published.
//  11. Return the published post + the run id.

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
import {
  recordWpPublishAttempt,
  recordWpPublishResult,
} from "@/lib/automation/wp-publish-audit";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";
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

  // Step 2: kill-switch check. Server env must explicitly enable
  // mutation-capable automation; defaults to disabled if missing.
  const ks = assertAutomationEnabled();
  if (!ks.ok) return automationDisabledResponse();

  // Step 3: per-instance rate limit. In-memory only; not a global
  // guarantee. Conservative limit: 10 publishes / 60s / IP.
  const rl = consumeAutomationRateLimit(request, AUTOMATION_RL.wpPublish);
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

  const { run_id, wp_post_id } = v.data;

  const db = getDb();
  const runs = new AutomationRunRepository(db);
  const items = new EditorialRepository(db);
  const logs = new AutomationLogRepository(db);
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
  const item = await items.findByRunId(run_id);
  if (!item) {
    await runs.setStatus(run_id, "failed", undefined, "editorial_link_missing");
    return conflict("editorial_link_missing", {
      reason: "automation_runs.editorial_item_id is NULL; cannot publish without an approved editorial item",
    });
  }

  // WP draft linkage gate. The AUTHORITATIVE source for the WP draft
  // id is automation_runs.output.wp_post_id (written by wp-draft
  // when the draft was created). The request body wp_post_id is
  // treated as a cross-check only — we never trust it by itself,
  // never fall back to editorial_items.wp_post_id (which is not
  // written by any code path), and we never silently substitute it.
  //
  // Fail-closed semantics:
  //   - run.output.wp_post_id missing / not a positive integer
  //     → 409 run_wp_id_missing (the run is misconfigured)
  //   - request.wp_post_id !== run.output.wp_post_id
  //     → 409 wp_post_mismatch (caller is talking about a different
  //       WP post than the run actually created; refuse rather than
  //       silently publishing a foreign post)
  const runOutput = (run.output ?? {}) as { wp_post_id?: unknown };
  const authoritativeWpId = runOutput.wp_post_id;
  if (
    typeof authoritativeWpId !== "number" ||
    !Number.isInteger(authoritativeWpId) ||
    authoritativeWpId <= 0
  ) {
    await runs.setStatus(run_id, "failed", undefined, "run_wp_id_missing");
    return conflict("run_wp_id_missing", {
      reason:
        "automation_runs.output.wp_post_id is missing or invalid; the WP draft id must come from wp-draft, not from the request body",
      run_id,
      request_wp_post_id: wp_post_id,
    });
  }
  if (authoritativeWpId !== wp_post_id) {
    await runs.setStatus(run_id, "failed", undefined, "wp_post_mismatch");
    return conflict("wp_post_mismatch", {
      editorial_item_id: item.id,
      run_wp_post_id: authoritativeWpId,
      request_wp_post_id: wp_post_id,
    });
  }

  if (item.approval_state !== "approved") {
    // approval_not_granted is terminal at the run-status level — flip
    // the run to failed because operator review is required.
    await runs.setStatus(run_id, "failed", undefined, "approval_not_granted");
    return conflict("approval_not_granted", {
      approval_state: item.approval_state,
      editorial_item_id: item.id,
    });
  }

  // HARD GATE #2 — rights clearance. rights_confirmed is the canonical
  // boolean a rights-check route sets ONLY when:
  //   (a) state == 'cleared' AND
  //   (b) a rights provider is configured.
  // The default for the column is false; so "missing" rights
  // (never checked) returns the same 409 here. This blocks publishing
  // for human-approved items whose rights were not cleared.
  if (!item.rights_confirmed) {
    const rightsMeta = (item.metadata as { rights?: { state?: string } } | null)?.rights;
    const rightsState = rightsMeta?.state ?? "missing";
    // Recoverable: do NOT flip automation_runs.status to 'failed'.
    // The operator/automation caller can clear rights and re-invoke
    // wp-publish on the same run.
    return conflict("rights_not_cleared", {
      editorial_item_id: item.id,
      rights_state: rightsState,
      rights_confirmed: false,
    });
  }

  // HARD GATE #3 — editorial stage must be 'approved'. This guards
  // against an admin approving an item whose stage is still earlier
  // in the pipeline (e.g. seo_check). The admin-approval mutation
  // also advances the stage to 'approved', so this check is normally
  // passed; this is belt-and-suspenders for any caller that bypassed
  // the admin route or hand-edited the stage column.
  // HARD GATE #3 — editorial stage must be 'approved' to advance to
  // 'published'. If the item is ALREADY 'published' from a prior
  // successful publish (whose state was hand-edited or whose
  // automation_runs row was reset), return idempotent 200 without
  // re-publishing. The published-stage check is performed BEFORE the
  // approved-stage guard so a 'published' row never reaches that gate
  // (it would otherwise 409 as stage_not_approved).
  const itemStagePre: string = item.stage;
  if (itemStagePre === "published") {
    return NextResponse.json(
      {
        ok: true,
        run_id,
        wp_post_id: authoritativeWpId,
        status: "publish",
        idempotent: true,
        note: "editorial item already published; returning cached state",
        editorial_item_id: item.id,
      },
      { status: 200 },
    );
  }

  if (item.stage !== "approved") {
    return conflict("stage_not_approved", {
      editorial_item_id: item.id,
      stage: item.stage,
    });
  }

  // Pre-mutation audit: insert "wp_publish_attempt" record BEFORE any
  // WordPress mutation. If this insert fails, refuse the publish and
  // never call WordPress.
  const preAudit = await recordWpPublishAttempt(logs, {
    editorial_item_id: item.id,
    wp_post_id: authoritativeWpId,
    request_wp_post_id: wp_post_id,
    request_id: null,
    ip_hash: null,
  });
  if (!preAudit.ok) {
    return NextResponse.json(
      { ok: false, error: "audit_log_unavailable" },
      { status: 503 },
    );
  }
  void preAudit.id;

  // Belt-and-suspenders: a defensive editor may hand-edit the run
  // status column. The editorial row's stage is the source of truth;
  // the early `published` check above already handled that case before
  // reaching this point. No further idempotency fallback needed here.
  void run;

  const wp = getWordPressWriteClient();
  if (!wp.configured) {
    await runs.setStatus(run_id, "failed", undefined, "wp_write_not_configured");
    return NextResponse.json(
      { ok: false, error: "wp_write_not_configured" },
      { status: 503 },
    );
  }

  try {
    // Use the AUTHORITATIVE wp_post_id (validated from run.output.wp_post_id
    // by the linkage gate above). The request-body wp_post_id has already
    // been cross-checked against authoritativeWpId and confirmed equal.
    const post = await wp.updatePost(authoritativeWpId, { status: "publish" });
    await runs.setStatus(run_id, "success", { wp_post_id: authoritativeWpId, wp_status: post.status });
    // Stage advance to 'published' AFTER the WP call succeeds, so a
    // transient WP failure does not prematurely mark the item as
    // published. setStage enforces adjacency (approved → published is
    // canonical forward), and the stage-machine blocks any further
    // transitions out of 'published' (terminal).
    await items.setStage(item.id, "published", run_id, "FF_HOOK_10");
    // Post-mutation audit: try-best, do NOT roll back on failure.
    const postAudit = await recordWpPublishResult(
      logs,
      {
        editorial_item_id: item.id,
        wp_post_id: authoritativeWpId,
        request_wp_post_id: wp_post_id,
        wp_status: post.status,
        request_id: null,
        ip_hash: null,
      },
      true,
    );
    return NextResponse.json(
      {
        ok: true,
        run_id,
        wp_post_id: authoritativeWpId,
        status: post.status,
        editorial_item_id: item.id,
        ...(postAudit.ok ? {} : { audit_log_degraded: true }),
      },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof WordPressWriteError) {
      const msg = e.kind; // timeout | network | http_4xx | http_5xx | invalid_json | not_configured
      await runs.setStatus(run_id, "failed", undefined, msg);
      // Post-mutation audit (failure). Try-best; surface degraded if
      // the audit insert itself fails.
      const postAudit = await recordWpPublishResult(
        logs,
        {
          editorial_item_id: item.id,
          wp_post_id: authoritativeWpId,
          request_wp_post_id: wp_post_id,
          failure_kind: msg,
          failure_http: e.status ?? null,
          request_id: null,
          ip_hash: null,
        },
        false,
      );
      const status = e.kind === "http_4xx" ? 400 : 502;
      return NextResponse.json(
        { ok: false, error: msg, status: e.status ?? null, ...(postAudit.ok ? {} : { audit_log_degraded: true }) },
        { status },
      );
    }
    throw e;
  }
}
