// Football Factory — POST /api/automation/media (Phase 18C.1)
//
// Server-to-server media upload for the n8n FF90-04 pipeline. The
// admin-cookie-authenticated /api/admin/posts/media route cannot be
// invoked by n8n because n8n only sends x-automation-secret. This
// route is the automation-authenticated equivalent.
//
// Auth:    x-automation-secret (via verifyAutomationSecret)
// Kill:    AUTOMATION_ENABLED === "true" (via assertAutomationEnabled)
// Body:    multipart/form-data
//            - file:     binary image body (required)
//            - post_id:  integer WP post id (optional) — if present,
//                        uploaded media is attached as featured_media
//                        on that post via WordPressWriteClient.updatePost.
//            - alt_text: string (optional)
//            - caption:  string (optional)
//            - title:    string (optional; defaults to filename)
//            - run_id:           string (uuid, optional) — recorded in
//                                audit for traceability
//            - editorial_item_id: string (uuid, optional) — recorded
//                                in audit for traceability
//
// Behavior:
//   1. Auth + kill-switch + rate limit.
//   2. Validate multipart envelope (non-file fields via zod).
//   3. Read the file part as bytes.
//   4. Hand off to WordPressWriteClient.uploadMedia (reused from
//      /api/admin/posts/media, no duplicated multipart/upload logic).
//   5. If post_id was supplied, attach as featured_media on that post.
//   6. Persist a structured audit row via AutomationLogRepository
//      (action="wp_media_upload"). NEVER echoes the secret, the
//      authorization header, or any WP credential.
//
// Hard rule: this route NEVER publishes. It only uploads media and
// optionally sets featured_media on an existing draft. Publishing is
// an explicit operator action against /api/automation/wp-publish.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
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
import { ipOf } from "@/lib/security/rate-limit";
import { redactSecrets } from "@/lib/auth/redact-secrets";
import {
  getWordPressWriteClient,
} from "@/lib/wordpress/__test-hooks__/write";
import { WordPressWriteError } from "@/lib/wordpress/write";
import { getDb } from "@/lib/db/postgres";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";
import { canUploadEditorialImage } from "@/lib/automation/rights-policy";

export const dynamic = "force-dynamic";

// 12 MB body cap for media upload. Same ceiling as the admin route.
const MAX_BODY_BYTES = 12 * 1024 * 1024;

// Non-file multipart fields. File bytes are validated separately.
const MultipartSchema = z.object({
  post_id: z.coerce.number().int().positive().optional(),
  alt_text: z.string().trim().max(500).optional(),
  caption: z.string().trim().max(2000).optional(),
  title: z.string().trim().max(500).optional(),
  run_id: z.string().uuid(),
  editorial_item_id: z.string().uuid(),
});

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): Response {
  return NextResponse.json(
    { ok: false, error, ...(extra ?? {}) },
    { status },
  );
}

export async function POST(request: Request) {
  // Step 1: automation secret. Fail-closed: missing/placeholder/short
  // secret returns 401 with no internal detail.
  const a = verifyAutomationSecret(request);
  if (!a.ok) return authRejectResponse(a);

  // Step 2: kill-switch. AUTOMATION_ENABLED must equal literal "true".
  const ks = assertAutomationEnabled();
  if (!ks.ok) return automationDisabledResponse();

  // Step 3: per-instance rate limit. Conservative: 30 uploads / 60s / IP.
  const rl = consumeAutomationRateLimit(request, AUTOMATION_RL.media);
  if (!rl.ok) return rateLimitedResponse(rl.resetMs);

  // Parse multipart body. content-type MUST be multipart/form-data.
  let form: FormData;
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().startsWith("multipart/form-data")) {
      return jsonError(400, "expected_multipart_form_data");
    }
    const cl = Number(request.headers.get("content-length") ?? "0");
    if (cl > MAX_BODY_BYTES) {
      return jsonError(413, "body_too_large", { max_bytes: MAX_BODY_BYTES });
    }
    form = await request.formData();
  } catch (e) {
    return jsonError(400, "invalid_multipart_body", {
      detail: (e as Error)?.message ?? "unknown",
    });
  }

  // Extract non-file fields for zod validation.
  const parsedInput: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k === "file") continue;
    parsedInput[k] = typeof v === "string" ? v : v.name;
  }
  const v = MultipartSchema.safeParse(parsedInput);
  if (!v.success) return jsonError(400, "validation_failed");

  // Read the file part.
  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return jsonError(400, "missing_file_part");
  }
  const fileBlob = fileEntry as unknown as Blob;
  const filename =
    (fileEntry as { name?: string }).name ?? "upload.jpg";
  const mimeType = fileBlob.type || "application/octet-stream";
  const buffer = new Uint8Array(await fileBlob.arrayBuffer());
  if (buffer.byteLength === 0) return jsonError(400, "empty_file");
  if (buffer.byteLength > MAX_BODY_BYTES) {
    return jsonError(413, "file_too_large", { max_bytes: MAX_BODY_BYTES });
  }

  if (!process.env.DATABASE_URL) return jsonError(503, "rights_verification_database_not_configured");
  const rightsResult = await getDb().query<{ rights_confirmed: boolean; metadata: unknown }>(
    `SELECT rights_confirmed, metadata FROM editorial_items
      WHERE id = $1 AND EXISTS (
        SELECT 1 FROM automation_runs run
         WHERE run.id = $2 AND run.editorial_item_id = editorial_items.id
      ) LIMIT 1`,
    [v.data.editorial_item_id, v.data.run_id],
  );
  const rightsMetadata = rightsResult.rows[0]?.metadata;
  const rights = rightsMetadata && typeof rightsMetadata === "object" && !Array.isArray(rightsMetadata)
    ? (rightsMetadata as Record<string, unknown>).rights as Record<string, unknown> | undefined
    : undefined;
  if (!rightsResult.rows[0]) return jsonError(409, "editorial_run_association_required");
  if (!canUploadEditorialImage({ rightsConfirmed: rightsResult.rows[0].rights_confirmed, rights })) {
    await auditMediaAttempt({
      action: "wp_media_upload",
      run_id: v.data.run_id,
      editorial_item_id: v.data.editorial_item_id,
      status: "failed",
      message: "rights_evidence_incomplete",
      metadata: { route: "automation/media", attempt: "rights_preflight", filename, mime_type: mimeType, size_bytes: buffer.byteLength, ip: ipOf(request) },
    });
    return jsonError(409, "rights_evidence_incomplete");
  }

  // Use the mockable factory if a test injected one; otherwise a real
  // client. This mirrors /api/automation/wp-publish and keeps the
  // upload logic out of the route layer.
  const wp = getWordPressWriteClient();
  if (!wp.configured) {
    await auditMediaAttempt({
      action: "wp_media_upload",
      run_id: v.data.run_id ?? null,
      editorial_item_id: v.data.editorial_item_id ?? null,
      status: "failed",
      message: "wp_write_not_configured",
      metadata: {
        route: "automation/media",
        attempt: "upload",
        error_code: "wp_write_not_configured",
        filename,
        mime_type: mimeType,
        size_bytes: buffer.byteLength,
        ip: ipOf(request),
      },
    });
    return jsonError(503, "wp_write_not_configured");
  }

  let uploadedMedia: Awaited<ReturnType<NonNullable<typeof wp.uploadMedia>>>;
  if (!wp.uploadMedia) {
    // Defensive: the factory contract allows uploadMedia to be absent
    // (most routes don't upload media). For the media route it's
    // required, so we surface 503 rather than attempting a 500.
    await auditMediaAttempt({
      action: "wp_media_upload",
      run_id: v.data.run_id ?? null,
      editorial_item_id: v.data.editorial_item_id ?? null,
      status: "failed",
      message: "wp_upload_not_supported",
      metadata: {
        route: "automation/media",
        attempt: "upload",
        error_code: "wp_upload_not_supported",
        filename,
        mime_type: mimeType,
        size_bytes: buffer.byteLength,
        ip: ipOf(request),
      },
    });
    return jsonError(503, "wp_upload_not_supported");
  }
  try {
    uploadedMedia = await wp.uploadMedia({
      buffer,
      filename,
      mimeType,
      altText: v.data.alt_text,
      caption: v.data.caption,
      title: v.data.title ?? filename,
    });
  } catch (e) {
    const code =
      e instanceof WordPressWriteError ? e.kind : "wp_error";
    const wpStatus =
      e instanceof WordPressWriteError ? e.status ?? null : null;
    await auditMediaAttempt({
      action: "wp_media_upload",
      run_id: v.data.run_id ?? null,
      editorial_item_id: v.data.editorial_item_id ?? null,
      status: "failed",
      message: code,
      metadata: {
        route: "automation/media",
        attempt: "upload",
        error_code: code,
        wp_status: wpStatus,
        filename,
        mime_type: mimeType,
        size_bytes: buffer.byteLength,
        ip: ipOf(request),
      },
    });
    // Map WP error kinds onto HTTP status codes that match the
    // admin route's convention: 4xx → 400, timeout/network → 502,
    // 5xx → 502. unknown errors fall through to 500.
    let status: number;
    if (e instanceof WordPressWriteError) {
      if (e.kind === "timeout" || e.kind === "network") {
        status = 502;
      } else if (e.kind === "http_5xx") {
        status = 502;
      } else if (e.kind === "http_4xx") {
        status = 400;
      } else if (e.kind === "not_configured") {
        status = 503;
      } else {
        // invalid_json or anything else
        status = 502;
      }
    } else {
      status = 500;
    }
    return jsonError(status, code, { wp_status: wpStatus });
  }

  // If post_id was supplied, attach as featured_media. Mirror the
  // admin route's behavior: media uploaded but attach failed returns
  // 207 with both pieces so the caller can retry the attach step.
  let attached: { post_id: number; featured_media: number } | null = null;
  let attachError: { code: string; wp_status: number | null } | null = null;
  if (v.data.post_id) {
    try {
      await wp.updatePost(v.data.post_id, {
        featured_media: uploadedMedia.id,
      });
      attached = {
        post_id: v.data.post_id,
        featured_media: uploadedMedia.id,
      };
    } catch (e) {
      const code =
        e instanceof WordPressWriteError ? e.kind : "wp_error";
      const wpStatus =
        e instanceof WordPressWriteError ? e.status ?? null : null;
      attachError = { code, wp_status: wpStatus };
      await auditMediaAttempt({
        action: "wp_media_attach",
        run_id: v.data.run_id ?? null,
        editorial_item_id: v.data.editorial_item_id ?? null,
        status: "failed",
        message: code,
        metadata: {
          route: "automation/media",
          attempt: "attach",
          error_code: code,
          wp_status: wpStatus,
          wp_media_id: uploadedMedia.id,
          post_id: v.data.post_id,
          ip: ipOf(request),
        },
      });
    }
  }

  // Success audit.
  await auditMediaAttempt({
    action: "wp_media_upload",
    run_id: v.data.run_id ?? null,
    editorial_item_id: v.data.editorial_item_id ?? null,
    status: "success",
    message: null,
    metadata: {
      route: "automation/media",
      attempt: "upload",
      wp_media_id: uploadedMedia.id,
      mime_type: mimeType,
      filename,
      size_bytes: buffer.byteLength,
      post_id: v.data.post_id ?? null,
      attached: !!attached,
      ip: ipOf(request),
    },
  });

  // Canonical response contract requested by FF90-04 workflow:
  //   ok, wp_media_id, source_url, mime_type.
  // Plus optional attached/attach_error fields for caller diagnostics.
  // Status semantics:
  //   200 — upload succeeded; no attach requested, or attach succeeded.
  //   207 — upload succeeded but the optional attach step failed (the
  //         caller should retry the attach on its own; the media itself
  //         is already on the WP side).
  const status = attachError ? 207 : 200;
  return NextResponse.json(
    {
      ok: true,
      wp_media_id: uploadedMedia.id,
      source_url: uploadedMedia.source_url ?? null,
      mime_type: uploadedMedia.mime_type ?? mimeType,
      ...(attached ? { attached: true, attachment: attached } : {}),
      ...(attachError
        ? {
            attached: false,
            attach_error: attachError.code,
            attach_wp_status: attachError.wp_status,
          }
        : {}),
    },
    { status },
  );
}

// ---------------------------------------------------------------------------
// Audit helper. Persists a structured row via AutomationLogRepository. This
// is best-effort: a failure here MUST NOT roll back the WP call (the media
// is already on the WP side). We swallow + log audit failures locally and
// return. The route contract still reports the real outcome to the caller.
// ---------------------------------------------------------------------------
async function auditMediaAttempt(args: {
  action: string;
  run_id: string | null;
  editorial_item_id: string | null;
  status: "success" | "failed";
  message: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return; // No DB → no audit. Route still returns success.
  try {
    const repo = new AutomationLogRepository(getDb());
    await repo.insert({
      run_id: args.run_id,
      action: args.action,
      stage: "media",
      status: args.status,
      message: args.message,
      metadata: redactSecrets(args.metadata),
      request_id: null,
      ip_hash: null,
    });
  } catch (e) {
    // Audit failure is non-fatal. Log to stderr only — never echo the
    // secret or any credential.
    // eslint-disable-next-line no-console
    console.warn(
      `[automation/media] audit insert failed: ${(e as Error)?.message ?? "unknown"}`,
    );
  }
}
