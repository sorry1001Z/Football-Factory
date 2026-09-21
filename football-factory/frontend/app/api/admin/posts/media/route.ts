// Football Factory — POST /api/admin/posts/media
//
// Admin-session equivalent of uploading a media file to WordPress and
// (optionally) attaching it to an existing WordPress post as the
// featured image.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    multipart/form-data with parts:
//            - file:    binary image body (required)
//            - post_id: integer WP post id to attach as featured_media
//                       (optional; if omitted, upload-only)
//            - alt_text: string (optional)
//            - caption:  string (optional)
//            - title:    string (optional; defaults to filename)
//
// Behavior:
//   - Reads the file part as bytes.
//   - Calls WordPressWriteClient.uploadMedia → returns WpMedia with id.
//   - If post_id was supplied, also calls WordPressWriteClient.updatePost
//     with featured_media=<id>.
//   - Hard rule: NEVER publishes the post. Only sets featured_media on
//     the existing draft.
//
// The upload + attach flow is best-effort idempotent: re-uploading the
// same file will create a NEW media entry on the WP side, but will
// overwrite the post's featured_media with the latest id. To avoid
// duplicates, callers should check for an existing media item first
// or reuse a stable filename + post_id.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import type { GuardResult } from "@/lib/admin/guard";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { consume, ipOf } from "@/lib/security/rate-limit";
import {
  WordPressWriteClient,
  WordPressWriteError,
} from "@/lib/wordpress/write";

export const dynamic = "force-dynamic";

// Body schema for the multipart envelope. File is binary and parsed
// separately; this schema validates the non-file fields.
const FormSchema = z.object({
  post_id: z.coerce.number().int().positive().optional(),
  alt_text: z.string().trim().max(500).optional(),
  caption: z.string().trim().max(2000).optional(),
  title: z.string().trim().max(500).optional(),
});

function rateKey(request: Request, userId?: string): string {
  return `admin_media_upload:${userId ?? ipOf(request)}`;
}

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error, ...(extra ?? {}) },
    { status },
  );
}

function applyGuard(g: GuardResult):
  | { kind: "response"; response: Response }
  | { kind: "session"; userId: string; role: string } {
  const resp = guardResponse(g);
  if (resp !== null) return { kind: "response", response: resp };
  if (g.ok) {
    return { kind: "session", userId: g.session.userId, role: g.session.role };
  }
  return {
    kind: "response",
    response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
  };
}

// 12 MB body cap for media upload (matches typical Vercel default).
const MAX_BODY_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const a = applyGuard(requireAdminOrEditor(request));
  if (a.kind === "response") return a.response;

  const rl = consume(rateKey(request, a.userId), 30, 60_000);
  if (!rl.ok) return jsonError(429, "rate_limited", { reset_ms: rl.reset_ms });

  // Read multipart body. We use request.formData() which Next.js
  // supports in the Node server bundle.
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
  const v = FormSchema.safeParse(parsedInput);
  if (!v.success) return jsonError(400, "validation_failed");

  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return jsonError(400, "missing_file_part");
  }
  const fileBlob = fileEntry as unknown as Blob;
  const filename = (fileEntry as { name?: string }).name ?? "upload.jpg";
  const mimeType = fileBlob.type || "application/octet-stream";
  const buffer = new Uint8Array(await fileBlob.arrayBuffer());
  if (buffer.byteLength === 0) return jsonError(400, "empty_file");
  if (buffer.byteLength > MAX_BODY_BYTES) {
    return jsonError(413, "file_too_large", {
      max_bytes: MAX_BODY_BYTES,
    });
  }

  const wp = new WordPressWriteClient();
  if (!wp.configured) return jsonError(503, "wp_write_not_configured");

  let uploadedMedia;
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
    if (e instanceof WordPressWriteError) {
      return jsonError(
        e.status && e.status >= 500 ? 502 : 400,
        e.kind,
        { wp_status: e.status ?? null },
      );
    }
    throw e;
  }

  // If post_id was provided, attach as featured_media.
  let attached: { post_id: number; featured_media: number } | null = null;
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
      // Media uploaded but attach failed — return both so the caller
      // can retry the attach without re-uploading.
      if (e instanceof WordPressWriteError) {
        return NextResponse.json(
          {
            ok: true,
            attached: false,
            media: uploadedMedia,
            error: e.kind,
            wp_status: e.status ?? null,
          },
          { status: 207 },
        );
      }
      throw e;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      media: uploadedMedia,
      attached,
    },
    { status: attached ? 200 : 201 },
  );
}
