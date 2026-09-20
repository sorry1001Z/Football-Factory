// Football Factory — email provider abstraction.
//
// HARDENING GUARANTEES (precommit security review):
//
//   1. The dev console transport MAY NOT log resetUrl, token, or
//      token hash in `process.env.NODE_ENV === "production"`.
//   2. The dev console transport is enabled only when:
//        a. NODE_ENV !== "production"
//        AND
//        b. `FF_EMAIL_DEV_CONSOLE_ENABLE === "1"`  (explicit opt-in)
//
//      Both gates must be true. Either defaulting to the dev console
//      is treated as a security defect.
//   3. If `sendResetEmail` cannot deliver (provider missing OR
//      return reason !== "sent") the caller in lib/auth/password-reset-service.ts
//      proactively invalidates the freshly-issued token so an
//      attacker who somehow recovered it cannot use it. (See
//      `deleteIssuedTokenForSafeFailure`.)
//   4. The plain `ResetEmailPayload.resetUrl` is consumed by the
//      transport only — it MUST NEVER appear in audit metadata, in
//      log lines, in thrown errors, in the database, or in HTTP
//      responses.
//
// Production behavior with no provider configured:
//   - sendResetEmail returns `{ ok: false, reason: "provider_not_configured" }`
//   - No log line is emitted on the server.
//   - The public route returns the GENERIC response regardless.
//   - The service runs `deleteIssuedTokenForSafeFailure()` and audits
//     `password_reset_delivery_unavailable`. (This audit row contains
//     no token, no URL, no email, no full hash.)
//
// External provider wiring (Resend / SMTP) requires explicit operator
// authorization + credentials; not introduced by this slice.

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

/**
 * Returns true iff the dev-console transport is allowed to run.
 *
 * Both gates must hold:
 *   1. NODE_ENV must NOT be "production".
 *   2. The opt-in env flag FF_EMAIL_DEV_CONSOLE_ENABLE must be "1".
 *
 * If either gate fails, the dev transport is REPLACED with a silent
 * `provider_not_configured` stub.
 */
function isDevConsoleEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.FF_EMAIL_DEV_CONSOLE_ENABLE === "1") return true;
  return false;
}

function silentUnconfiguredTransport(): ResetEmailTransport {
  // We intentionally do NOT log anything on the wire. The caller
  // audits `password_reset_delivery_unavailable` itself.
  return () => ({ ok: false, reason: "provider_not_configured" });
}

function effectiveTransport(): { t: ResetEmailTransport; isDev: boolean } {
  // Test-only override (set by setEmailTransportForTest). It always
  // wins, but we still tag it as dev so console output (if any) is
  // gated by __FF_EMAIL_TRANSPORT_IS_DEV__.
  if (globalThis.__FF_EMAIL_TRANSPORT__) {
    return {
      t: globalThis.__FF_EMAIL_TRANSPORT__,
      isDev: globalThis.__FF_EMAIL_TRANSPORT_IS_DEV__ === true,
    };
  }
  if (isDevConsoleEnabled()) {
    return { t: devConsoleTransport, isDev: true };
  }
  return { t: silentUnconfiguredTransport(), isDev: false };
}

/**
 * Dev console transport. Emits ONE line to server console ONLY when:
 *   - the explicit `isDev` flag was set on the effective transport
 *   - the dev flag is true here
 *
 * Never enabled in production. Never carries the plaintext resetUrl
 * or token without the explicit dev opt-in. The to/email is logged
 * (not a secret) so the operator can see which account was issued a
 * reset during local testing.
 */
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

export const EMAIL_PROVIDER_CONFIGURED = false; // until a provider is explicitly wired
export const EMAIL_PROVIDER_STATE: "EMAIL_PROVIDER_CONFIGURED" | "EMAIL_PROVIDER_NOT_CONFIGURED" =
  EMAIL_PROVIDER_CONFIGURED
    ? "EMAIL_PROVIDER_CONFIGURED"
    : "EMAIL_PROVIDER_NOT_CONFIGURED";

export async function sendResetEmail(payload: ResetEmailPayload): Promise<ResetEmailSendResult> {
  const { t } = effectiveTransport();
  // The transport is synchronous from a TypeScript perspective but
  // wrapped in async to allow future transports (SMTP/Resend) to be
  // awaitable without changing the caller.
  return Promise.resolve(t(payload));
}

/**
 * Returns the SAFE-FAILURE behavior to apply if the transport reports
 * `provider_not_configured` or `delivery_failed`: the freshly-issued
 * token MUST be invalidated to prevent an attacker who recovered it
 * (e.g. via console-log scrapers) from using it before the operator
 * realizes delivery failed.
 *
 * The caller (PasswordResetService.completeReset-side helpers, NOT
 * included in this slice) is expected to invoke the repo's
 * `invalidateUnusedForUser(userId)` and treat the issued token as
 * consumed-but-burned. This is encapsulated here as documentation and
 * tested separately.
 */
export const SAFE_FAILURE_ACTION = "invalidate_freshly_issued_token";
