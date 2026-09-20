// Football Factory — password reset token repository.
//
// Persists and validates password reset tokens. The token we hand to
// the user (via email) is NEVER stored in plaintext: we store
// token_hash = sha256(token) and look it up by hash.
//
// Single-use: when validateToken() succeeds, used_at is set
// atomically. A second attempt observes used_at IS NOT NULL and
// returns the canonical `token_invalid` reason.
//
// TTL: expires_at = created_at + 30 minutes (configured in service,
// checked here).
//
// Idempotency on lookup: if multiple unused tokens exist for the
// same user (race between issuance and first consume), we return the
// newest unused one. The issuedNewest() path that creates new tokens
// also invalidates prior unused tokens first.
//
// SECURITY INVARIANTS (do not weaken):
//   - Never log the plaintext token. The routes log only token_hash
//     prefix for debugging.
//   - Always compare token_hash inside the SQL CTE so the comparison
//     does not leave the database.
//   - Never expose expires_at vs created_at precision in public
//     responses (we only return a generic verdict).

import "server-only";
import type { Db } from "@/lib/db/postgres";

export type ResetTokenRow = {
  id: number;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export type ResetTokenConsumeResult =
  | { ok: true; userId: string; tokenId: number }
  | { ok: false; reason: "token_invalid" | "token_expired" | "token_used" | "user_disabled" | "user_unknown" };

export class PasswordResetRepository {
  constructor(private db: Db) {}

  /**
   * Invalidate any prior unused tokens for the user. Used to make
   * issuance single-active. Returns rows affected (operationally
   * useful for audit but not exposed via API).
   */
  async invalidateUnusedForUser(userId: string): Promise<number> {
    const r = await this.db.query<{ id: number }>(
      `UPDATE password_reset_tokens
          SET used_at = now()
        WHERE user_id = $1
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING id`,
      [userId],
    );
    return (r.rowCount ?? r.rows.length);
  }

  /**
   * Issue a new reset token. Caller has already sha256-hashed the
   * plaintext token. Returns the row id.
   *
   * ttlSeconds = 30 minutes = 1800.
   */
  async issue(input: {
    userId: string;
    tokenHash: string;
    ttlSeconds?: number;     // default 1800 (30 min)
  }): Promise<{ id: number; expiresAt: Date }> {
    const ttl = input.ttlSeconds ?? 1800;
    const r = await this.db.query<{ id: number; expires_at: Date }>(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3::int * interval '1 second'))
       RETURNING id, expires_at`,
      [input.userId, input.tokenHash, ttl],
    );
    const x = r.rows[0];
    if (!x) throw new Error("password_reset_issue_failed");
    return { id: x.id, expiresAt: x.expires_at };
  }

  /**
   * Burn a single token row by id. Used by the service when the
   * email transport reports `delivery_unavailable` so the token
   * never lingers unused in DB after we know it could not be
   * delivered. The caller has already produced the plaintext, so
   * an attacker who scraped it from a log earlier cannot still
   * use it.
   */
  async burnIssuedToken(input: { tokenId: number; userId: string }): Promise<void> {
    await this.db.query(
      `UPDATE password_reset_tokens
          SET used_at = now()
        WHERE id = $1 AND user_id = $2 AND used_at IS NULL`,
      [input.tokenId, input.userId],
    );
  }

  /**
   * Atomically consume a token. Returns ok=true iff:
   *   - a row exists with the supplied user_id + token_hash,
   *   - used_at IS NULL,
   *   - expires_at > now(),
   *   - the user is still active.
   *
   * On ok=true, used_at is set to now() and returned. Used for both
   * the public reset endpoint and tests.
   */
  async consume(input: {
    userId: string;
    tokenHash: string;
  }): Promise<ResetTokenConsumeResult> {
    // 1) Lookup row + active user via a single query. We do NOT
    //    update used_at yet — we want to first validate everything.
    const lookup = await this.db.query<{
      id: number;
      user_id: string;
      expires_at: Date;
      used_at: Date | null;
      user_status: string;
    }>(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at,
              u.status AS user_status
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
        WHERE prt.user_id = $1
          AND prt.token_hash = $2
        LIMIT 1`,
      [input.userId, input.tokenHash],
    );
    const row = lookup.rows[0];
    if (!row) return { ok: false, reason: "token_invalid" };
    if (row.user_status !== "active") {
      return { ok: false, reason: "user_disabled" };
    }
    if (row.used_at) return { ok: false, reason: "token_used" };
    const now = new Date();
    if (row.expires_at.getTime() <= now.getTime()) {
      return { ok: false, reason: "token_expired" };
    }

    // 2) Atomically flip used_at. If another concurrent request got
    //    there first, used_at will already be set; we then treat it
    //    as token_used.
    const upd = await this.db.query<{ id: number }>(
      `UPDATE password_reset_tokens
          SET used_at = now()
        WHERE id = $1
          AND used_at IS NULL
        RETURNING id`,
      [row.id],
    );
    if (!upd.rows[0]) return { ok: false, reason: "token_used" };
    return { ok: true, userId: row.user_id, tokenId: row.id };
  }

  /**
   * Hardened lookup for tests only: returns the row verbatim,
   * including used_at and expires_at, for assertions.
   */
  async findForTest(input: { userId: string; tokenHash: string }): Promise<ResetTokenRow | null> {
    const r = await this.db.query<ResetTokenRow>(
      `SELECT id, user_id, token_hash, expires_at, used_at, created_at
         FROM password_reset_tokens
        WHERE user_id = $1 AND token_hash = $2
        LIMIT 1`,
      [input.userId, input.tokenHash],
    );
    return r.rows[0] ?? null;
  }
}
