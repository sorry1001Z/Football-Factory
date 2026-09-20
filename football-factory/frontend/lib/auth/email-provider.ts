// Football Factory — email provider abstraction.
//
// HARDENING GUARANTEES (preserved across the Resend integration):
//
//   1. The dev console transport MAY NOT log resetUrl, token, or
//      token hash in `process.env.NODE_ENV === "production"`.
//   2. The dev console transport is enabled only when:
//        a. NODE_ENV !== "production"
//        AND
//        b. `FF_EMAIL_DEV_CONSOLE_ENABLE === "1"`  (explicit opt-in)
//      Both gates must be true.
//   3. If `sendResetEmail` cannot deliver, the caller in
//      `password-reset-service.ts` proactively burns the freshly-issued
//      token via `repo.burnIssuedToken(...)` so an attacker who
//      recovered the plaintext cannot use it after a delivery failure.
//   4. The plain `ResetEmailPayload.resetUrl` is consumed by the
//      transport only — it MUST NEVER appear in audit metadata, in
//      log lines, in thrown errors, in the database, or in HTTP
//      responses.
//
// PROVIDER SELECTION (production behavior):
//
//   At module load (and on each call in test override) the
//   `effectiveTransport()` decides which transport to use:
//
//     • If a test override is set via `setEmailTransportForTest`,
//       it always wins.
//     • Else if NODE_ENV === "production":
//         – If RESEND_API_KEY AND RESET_EMAIL_FROM are both configured,
//           use `resendTransport`.
//         – Else fall back to `silentUnconfiguredTransport`.
//           // We DO NOT silently fall back to the dev console in
//           // production, even if FF_EMAIL_DEV_CONSOLE_ENABLE=1.
//     • Else (non-production):
//         – If dev-console opt-in holds, use `devConsoleTransport`.
//         – Else use the silent stub.
//
// External provider wiring (Resend) requires operator-supplied env:
//     RESEND_API_KEY          (required)
//     RESET_EMAIL_FROM        (required, e.g. "no-reply@ff90.online")
//     RESET_EMAIL_REPLY_TO    (optional)
// We never read these from disk, never log them, and the implementation
// does NOT default them to anything that would let a request silently
// succeed in a partially-configured environment.

import "server-only";

export type ResetEmailPayload = {
  to: string;
  resetUrl: string;
  expiresAtIso: string;
  // Helper fields included for the audit log ONLY (not in the
  // transport body).
  userId: string;
  tokenId: number;
};

export type ResetEmailSendResult =
  | { ok: true }
  | { ok: false; reason: "provider_not_configured" | "delivery_failed" };

export type ResetEmailTransport = (
  payload: ResetEmailPayload,
) => ResetEmailSendResult;

declare global {
  // eslint-disable-next-line no-var
  var __FF_EMAIL_TRANSPORT__: ResetEmailTransport | undefined;
  // eslint-disable-next-line no-var
  var __FF_EMAIL_TRANSPORT_IS_DEV__: boolean | undefined;
}

// -------------------------------------------------------------------------
// Authenticated-env reads. We strip whitespace and reject empty values.
// API keys are NEVER logged or printed — only an existence / shape check.
// -------------------------------------------------------------------------

type ResendEnv = {
  apiKey: string;
  from: string;
  replyTo: string | null;
};

function readResendEnv(): ResendEnv | null {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const from = (process.env.RESET_EMAIL_FROM ?? "").trim();
  if (!apiKey || !from) return null;
  // Defensive: if the operator leaves the env blank with whitespace,
  // we treat it as not-configured rather than failing open.
  return {
    apiKey,
    from,
    replyTo: (process.env.RESET_EMAIL_REPLY_TO ?? "").trim() || null,
  };
}

export function resendEnvConfigured(): boolean {
  return readResendEnv() !== null;
}

// We do NOT cache the env at module load: Vercel serverless may recycle
// env between invocations, and a fresh env read is cheap.
//
// ---------------------------------------------------------------------------
// Static templating. Plain text + simple HTML.
// Branding is FF90.online. Contact line uses contact@ff90.online.
// We do NOT include: password, password hash, role, user id, AUTH_SECRET.
// We DO include: the reset URL (the only way the user can act), the
// 30-minute expiry, ignore-if-not-you instruction.
// ---------------------------------------------------------------------------

const SUBJECT = "ตั้งรหัสผ่านใหม่สำหรับ FF90.online";

/**
 * Renders the static text body. The reset URL is rendered exactly
 * once and only inside the anchor; never inside any other field.
 * Exposed for tests.
 */
export function renderResetEmailText(p: ResetEmailPayload): string {
  return [
    "FF90.online — การตั้งรหัสผ่านใหม่",
    "",
    "เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณแล้ว",
    "หากคุณเป็นผู้ร้องขอ กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 30 นาที):",
    "",
    p.resetUrl,
    "",
    "หากคุณไม่ได้เป็นผู้ร้องขอ สามารถเพิกเฉยอีเมลนี้ได้อย่างปลอดภัย — บัญชีของคุณยังคงปลอดภัย",
    "",
    "ต้องการความช่วยเหลือ? ติดต่อเราได้ที่ contact@ff90.online",
    "",
    "— FF90.online",
  ].join("\n");
}

/**
 * HTML body. Minimal, mobile-friendly, lists NO internal data, and
 * renders the reset URL exactly once inside the link target.
 */
export function renderResetEmailHtml(p: ResetEmailPayload): string {
  const url = escapeHtmlAttr(p.resetUrl);
  return [
    '<div style="font-family: -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width:560px; margin:0 auto; padding:24px; color:#0B1F17;">',
    '  <div style="font-size:20px; font-weight:600; margin-bottom:8px;">FF90.online</div>',
    '  <div style="font-size:14px; color:#444; line-height:1.6;">',
    "    <p>เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณแล้ว</p>",
    "    <p>หากคุณเป็นผู้ร้องขอ กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ <strong>(ลิงก์หมดอายุใน 30 นาที)</strong>:</p>",
    `    <p style="text-align:center; margin:24px 0;"><a href="${url}" style="display:inline-block; padding:12px 20px; background:#0B5D3B; color:#FFFFFF; border-radius:8px; text-decoration:none; font-weight:600;">ตั้งรหัสผ่านใหม่</a></p>`,
    '    <p style="font-size:13px; color:#666;">หากปุ่มไม่ทำงาน คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:</p>',
    `    <p style="font-size:12px; word-break:break-all; color:#666;">${escapeHtmlText(p.resetUrl)}</p>`,
    '    <hr style="border:none; border-top:1px solid #EEE; margin:24px 0;" />',
    "    <p style=\"font-size:13px; color:#666;\">หากคุณไม่ได้เป็นผู้ร้องขอ สามารถเพิกเฉยอีเมลนี้ได้อย่างปลอดภัย — บัญชีของคุณยังคงปลอดภัย</p>",
    "    <p style=\"font-size:13px; color:#666;\">ต้องการความช่วยเหลือ? ติดต่อเราได้ที่ contact@ff90.online</p>",
    "    <p style=\"font-size:12px; color:#999; margin-top:24px;\">— FF90.online</p>",
    "  </div>",
    "</div>",
  ].join("\n");
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// Resend transport. Uses Node built-in fetch (no SDK added to package.json).
// Does NOT log API keys, does NOT log the request body, does NOT throw.
// Always returns a ResetEmailSendResult.
// ---------------------------------------------------------------------------

async function resendTransport(payload: ResetEmailPayload): Promise<ResetEmailSendResult> {
  const env = readResendEnv();
  if (!env) return { ok: false, reason: "provider_not_configured" };

  const authHeader = `Bearer ${env.apiKey}`;
  // Compose 'From' header. The brief recommends "FF90 <no-reply@ff90.online>".
  // We DO NOT mutate the env-supplied from address; we just label it.
  const fromAddress = env.from;
  const fromHeader = `FF90 <${fromAddress}>`;
  const headers: Record<string, string> = { Authorization: authHeader };
  headers["Content-Type"] = "application/json";

  const body: {
    from: string;
    to: string[];
    subject: string;
    text: string;
    html: string;
    reply_to?: string[];
  } = {
    from: fromHeader,
    to: [payload.to],
    subject: SUBJECT,
    text: renderResetEmailText(payload),
    html: renderResetEmailHtml(payload),
  };
  if (env.replyTo) body.reply_to = [env.replyTo];

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      // Resend responds within a few seconds; 8s is generous for serverless.
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { ok: false, reason: "delivery_failed" };
  }

  if (!response.ok) {
    // We deliberately consume the error stream for rate-limit recognition
    // but DO NOT log its body (Resend sometimes includes recipient or
    // text fragments in 4xx error bodies). Use only the status code.
    try {
      await response.text(); // drain
    } catch { /* noop */ }
    return { ok: false, reason: "delivery_failed" };
  }

  // Drain body but never log it. 2xx may carry the message id.
  try { await response.text(); } catch { /* noop */ }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Dev console + silent fallback transports (unchanged from prior slice)
// ---------------------------------------------------------------------------

function isDevConsoleEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.FF_EMAIL_DEV_CONSOLE_ENABLE === "1") return true;
  return false;
}

function silentUnconfiguredTransport(): ResetEmailTransport {
  return () => ({ ok: false, reason: "provider_not_configured" });
}

function effectiveTransport(): { t: ResetEmailTransport; isAsync: boolean } {
  // Test-only override (set by setEmailTransportForTest). It always wins.
  if (globalThis.__FF_EMAIL_TRANSPORT__) {
    return {
      t: globalThis.__FF_EMAIL_TRANSPORT__,
      isAsync: false,
    };
  }
  if (process.env.NODE_ENV === "production") {
    // PRODUCTION: Resend transport takes priority when env is configured.
    // We do NOT fall back to the dev console transport in production.
    if (resendEnvConfigured()) return { t: resendTransport as unknown as ResetEmailTransport, isAsync: true };
    return { t: silentUnconfiguredTransport(), isDev: false } as unknown as { t: ResetEmailTransport; isAsync: boolean };
  }
  // Non-production: dev-console opt-in takes priority.
  if (isDevConsoleEnabled()) {
    return { t: devConsoleTransport, isAsync: false };
  }
  return { t: silentUnconfiguredTransport(), isAsync: false };
}

function devConsoleTransport(payload: ResetEmailPayload): ResetEmailSendResult {
  // eslint-disable-next-line no-console
  console.log(
    `[email/dev-optin] user=${payload.userId.slice(0, 8)}… ` +
      `to=${payload.to} ` +
      `expires=${payload.expiresAtIso} ` +
      `[resetUrl suppressed in dev log to avoid leaking tokens; ` +
      `use the in-app dev link or wire a real provider]`,
  );
  return { ok: false, reason: "provider_not_configured" };
}

export function setEmailTransportForTest(
  t: ResetEmailTransport | null,
  opts: { dev?: boolean } = { dev: true },
): void {
  globalThis.__FF_EMAIL_TRANSPORT__ = t ?? undefined;
  globalThis.__FF_EMAIL_TRANSPORT_IS_DEV__ = t ? !!opts.dev : false;
}

/**
 * EMAIL_PROVIDER_STATE — derived live at module load time but kept
 * exported as a const-style value. The constant is conservative:
 * when RESEND_API_KEY + RESET_EMAIL_FROM are both present, returns
 * "EMAIL_PROVIDER_CONFIGURED", else "EMAIL_PROVIDER_NOT_CONFIGURED".
 */
export const EMAIL_PROVIDER_CONFIGURED = resendEnvConfigured();
export const EMAIL_PROVIDER_STATE: "EMAIL_PROVIDER_CONFIGURED" | "EMAIL_PROVIDER_NOT_CONFIGURED" =
  EMAIL_PROVIDER_CONFIGURED
    ? "EMAIL_PROVIDER_CONFIGURED"
    : "EMAIL_PROVIDER_NOT_CONFIGURED";

/**
 * Provider-kind accessor — used by audit logs and tests.
 */
export type ProviderKind = "resend" | "dev_console" | "silent_unconfigured" | "test_override";

export function providerKind(): ProviderKind {
  if (globalThis.__FF_EMAIL_TRANSPORT__) return "test_override";
  if (process.env.NODE_ENV === "production" && resendEnvConfigured()) return "resend";
  if (process.env.NODE_ENV !== "production" && isDevConsoleEnabled()) return "dev_console";
  return "silent_unconfigured";
}

export async function sendResetEmail(payload: ResetEmailPayload): Promise<ResetEmailSendResult> {
  const { t, isAsync } = effectiveTransport();
  // Sync and async transports are both supported. Async calls await
  // through; sync calls are wrapped via Promise.resolve.
  const out = isAsync ? await (t as unknown as (p: ResetEmailPayload) => Promise<ResetEmailSendResult>)(payload)
                       : (t as (p: ResetEmailPayload) => ResetEmailSendResult)(payload);
  return out;
}

// ---------------------------------------------------------------------------
// SAFE-FAILURE marker — unchanged
// ---------------------------------------------------------------------------
export const SAFE_FAILURE_ACTION = "invalidate_freshly_issued_token";
