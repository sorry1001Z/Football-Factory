// Football Factory — authenticated password change helper.
//
// Used by the Admin Tools Change Password form. The caller MUST
// have already authenticated the user (i.e. `session.userId` is
// trustworthy). We:
//   - verify the supplied current password against the stored hash
//   - hash the new password with the canonical hashPassword()
//   - update users.password_hash
//   - invalidate outstanding password_reset_tokens for this user
//   - audit the change with NO password / hash content
//
// Returns a discriminated result. The route layer maps these to
// generic UX strings (never reveal whether the user existed).

import "server-only";
import type { Db } from "@/lib/db/postgres";
import { hashPassword, verifyPassword } from "./password";
import { AutomationLogRepository } from "./automation-log-repository";

export type ChangePasswordOk = { ok: true };
export type ChangePasswordErr =
  | { ok: false; reason: "wrong_current_password" | "policy_failed" | "rate_limited" | "user_unknown" };

export class AuthenticatedChangePassword {
  private audit: AutomationLogRepository;

  constructor(private db: Db) {
    this.audit = new AutomationLogRepository(db);
  }

  async change(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    ipHash: string | null;
    requestId: string | null;
  }): Promise<ChangePasswordOk | ChangePasswordErr> {
    const r = await this.db.query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE id = $1 AND status = 'active' LIMIT 1",
      [input.userId],
    );
    const u = r.rows[0];
    if (!u) return { ok: false, reason: "user_unknown" };

    // Verify current password first.
    if (!verifyPassword(input.currentPassword, u.password_hash)) {
      await this.audit.insert({
        run_id: null,
        action: "password_changed_authenticated",
        stage: "verify_current",
        status: "wrong_current",
        message: null,
        metadata: { user_id: u.id },
        request_id: input.requestId,
        ip_hash: input.ipHash,
      });
      return { ok: false, reason: "wrong_current_password" };
    }

    // Hash the new password. hashPassword() throws PasswordError on
    // policy violation; we catch and surface as policy_failed.
    let newHash: string;
    try {
      newHash = hashPassword(input.newPassword);
    } catch {
      return { ok: false, reason: "policy_failed" };
    }

    // Update + invalidate outstanding reset tokens in a transaction.
    await this.db.query("BEGIN", []);
    try {
      await this.db.query(
        "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
        [u.id, newHash],
      );
      await this.db.query(
        `UPDATE password_reset_tokens SET used_at = now()
          WHERE user_id = $1 AND used_at IS NULL`,
        [u.id],
      );
      await this.db.query("COMMIT", []);
    } catch (err) {
      await this.db.query("ROLLBACK", []);
      throw err;
    }

    await this.audit.insert({
      run_id: null,
      action: "password_changed_authenticated",
      stage: "complete",
      status: "success",
      message: null,
      metadata: { user_id: u.id },
      request_id: input.requestId,
      ip_hash: input.ipHash,
    });

    return { ok: true };
  }
}
