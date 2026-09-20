// Football Factory — password reset service.
//
// Orchestrates:
//   - random token generation
//   - sha-256 hashing for storage
//   - issuing and invalidating prior tokens (single-active)
//   - sending the reset email
//   - auditing state transitions
//
// Does NOT:
//   - log plaintext tokens
//   - leak the token via API response
//   - reveal whether an account exists (caller responsibility)

import "server-only";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import type { Db } from "@/lib/db/postgres";
import { PasswordResetRepository } from "./password-reset-repository";
import { AutomationLogRepository } from "./automation-log-repository";
import {
  sendResetEmail,
  EMAIL_PROVIDER_STATE,
} from "./email-provider";

export const RESET_TTL_SECONDS = 30 * 60;     // 30 minutes
export const RESET_TOKEN_BYTES = 32;          // 256 bits, base64url-encoded ~43 chars

export type ResetRequestInput = {
  email: string;
  ipHash: string | null;
  requestId: string | null;
};

export type ResetRequestOutcome = {
  /**
   * Always "ok" for the public caller regardless of whether an
   * account exists, per spec (no enumeration).
   */
  ok: true;
  /**
   * Delivery state of the email transport. NOT leaked externally;
   * surfaced here for audit only.
   */
  deliveryStatus: "sent" | "delivery_unavailable" | "skipped_user_disabled";
};

/**
 * Lowercase trim + validate email shape WITHOUT using zod to keep
 * the forgot-password path free of unnecessary dependencies. We do
 * not import zod here to avoid the failure-mode where an upstream
 * bug in email normalization leaks account-existence information.
 *
 * Returns null when the email is structurally invalid (no @, no
 * dot in the domain). Routes can treat null as the same public
 * response as a valid-but-unknown email.
 */
export function normalizeEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e.length < 3 || e.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

/**
 * Hashes the plaintext token for storage / lookup. Returns
 * lowercase hex sha-256 (64 chars). Matches the
 *   char_length(token_hash) = 64
 * check on the table.
 */
export function hashResetToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf-8").digest("hex");
}

/**
 * Generates a cryptographically random plaintext token.
 * Returns a base64url-encoded string of RESET_TOKEN_BYTES random bytes.
 * Length: ceil(32 * 4 / 3) = 43 chars (base64url).
 */
export function generateResetToken(): string {
  return randomBytes(RESET_TOKEN_BYTES).toString("base64url");
}

/**
 * Builds the public reset URL. Pure: no DB or fetch.
 */
export function buildResetUrl(siteUrl: string, token: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/admin/reset-password?token=${encodeURIComponent(token)}`;
}

export class PasswordResetService {
  private repo: PasswordResetRepository;
  private audit: AutomationLogRepository;

  constructor(
    private db: Db,
    private siteUrl: string,
  ) {
    this.repo = new PasswordResetRepository(db);
    this.audit = new AutomationLogRepository(db);
  }

  /**
   * Public endpoint helper. ALWAYS returns ok=true regardless of
   * whether the email exists, status, etc. The caller should log
   * internal state via the audit table but never leak it.
   */
  async requestReset(input: ResetRequestInput): Promise<ResetRequestOutcome> {
    const norm = normalizeEmail(input.email);
    if (!norm) {
      return { ok: true, deliveryStatus: "skipped_user_disabled" };
    }
    const r = await this.db.query<{ id: string; status: string }>(
      "SELECT id, status FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [norm],
    );
    const user = r.rows[0];
    if (!user) {
      // No enumeration: pretend we did work. Audit nothing PII-able.
      await this.audit.insert({
        run_id: null,
        action: "password_reset_requested",
        stage: "request",
        status: "unknown_account",
        message: null,
        metadata: { ip_hash: input.ipHash },
        request_id: input.requestId,
        ip_hash: input.ipHash,
      });
      return { ok: true, deliveryStatus: "skipped_user_disabled" };
    }
    if (user.status !== "active") {
      await this.audit.insert({
        run_id: null,
        action: "password_reset_requested",
        stage: "request",
        status: "inactive_account",
        message: null,
        metadata: { user_id: user.id, ip_hash: input.ipHash },
        request_id: input.requestId,
        ip_hash: input.ipHash,
      });
      return { ok: true, deliveryStatus: "skipped_user_disabled" };
    }

    // Invalidate prior outstanding tokens for this user so only the
    // new one is active.
    await this.repo.invalidateUnusedForUser(user.id);

    const plaintext = generateResetToken();
    const tokenHash = hashResetToken(plaintext);
    const issue = await this.repo.issue({
      userId: user.id,
      tokenHash,
      ttlSeconds: RESET_TTL_SECONDS,
    });

    const resetUrl = buildResetUrl(this.siteUrl, plaintext);

    let delivery: "sent" | "delivery_unavailable";
    try {
      const sent = await sendResetEmail({
        to: norm,
        resetUrl,
        expiresAtIso: issue.expiresAt.toISOString(),
        userId: user.id,
        tokenId: issue.id,
      });
      delivery = sent.ok ? "sent" : "delivery_unavailable";
    } catch {
      delivery = "delivery_unavailable";
    }

    if (delivery === "delivery_unavailable") {
      // Burn the freshly-issued token so an attacker who recovered
      // the plaintext via a stray console log or transport failure
      // still cannot use it. The complete() path will then see
      // used_at IS NOT NULL and return token_used.
      await this.repo.burnIssuedToken({ tokenId: issue.id, userId: user.id });
      await this.audit.insert({
        run_id: null,
        action: "password_reset_delivery_unavailable",
        stage: "email",
        status: "transport_unavailable",
        message: null,
        metadata: {
          user_id: user.id,
          email_provider_state: EMAIL_PROVIDER_STATE,
          burned_token_id: issue.id,
        },
        request_id: input.requestId,
        ip_hash: input.ipHash,
      });
    }

    await this.audit.insert({
      run_id: null,
      action: "password_reset_requested",
      stage: "request",
      status: "active_account_issued",
      message: null,
      metadata: {
        user_id: user.id,
        token_id: issue.id,
        // log token_hash PREFIX (12 chars) ONLY — never full hash
        token_hash_prefix: tokenHash.slice(0, 12),
        delivery,
      },
      request_id: input.requestId,
      ip_hash: input.ipHash,
    });

    return { ok: true, deliveryStatus: delivery };
  }

  /**
   * Public endpoint helper. Returns a discriminated result that the
   * route maps to either a generic success or a validation message.
   *
   * NEVER returns the plaintext token or hash to the caller.
   */
  async completeReset(input: {
    userId: string;
    plaintextToken: string;
    newPasswordHash: string;
    ipHash: string | null;
    requestId: string | null;
  }): Promise<
    | { ok: true }
    | { ok: false; reason: "token_invalid" | "token_used" | "token_expired" | "user_disabled" | "user_unknown" }
  > {
    const tokenHash = hashResetToken(input.plaintextToken);
    const consume = await this.repo.consume({
      userId: input.userId,
      tokenHash,
    });
    if (!consume.ok) {
      await this.audit.insert({
        run_id: null,
        action: "password_reset_requested",
        stage: "complete",
        status: consume.reason,
        message: null,
        metadata: {
          user_id: input.userId,
          token_hash_prefix: tokenHash.slice(0, 12),
        },
        request_id: input.requestId,
        ip_hash: input.ipHash,
      });
      return { ok: false, reason: consume.reason };
    }

    // Apply the password update under a transaction. We also
    // invalidate any leftover unused tokens for this user.
    await this.db.query("BEGIN", []);
    try {
      await this.db.query(
        "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
        [consume.userId, input.newPasswordHash],
      );
      await this.db.query(
        `UPDATE password_reset_tokens SET used_at = now()
          WHERE user_id = $1 AND used_at IS NULL`,
        [consume.userId],
      );
      await this.db.query("COMMIT", []);
    } catch (err) {
      await this.db.query("ROLLBACK", []);
      throw err;
    }

    await this.audit.insert({
      run_id: null,
      action: "password_reset_completed",
      stage: "complete",
      status: "success",
      message: null,
      metadata: {
        user_id: consume.userId,
        token_id: consume.tokenId,
        token_hash_prefix: tokenHash.slice(0, 12),
      },
      request_id: input.requestId,
      ip_hash: input.ipHash,
    });

    return { ok: true };
  }
}
