-- Football Factory — admin password reset tokens (004).
--
-- Adds a `password_reset_tokens` table for the forgot-password slice.
--
-- Security invariants:
--   - The token we emit to the user via email is NEVER stored in
--     plaintext. We store `token_hash` (sha-256 hex of the token).
--   - Lookup at validate-time hashes the supplied token with the same
--     algorithm and compares with constant-time equality via SQL
--     CTE-filter (PG handles byte comparison; we additionally AND the
--     expiry / used / active checks in the same statement).
--   - Single-use: `used_at` is set on consume; a second consume must
--     see a non-null used_at and fail.
--   - TTL: `expires_at = created_at + interval '30 minutes'`.
--
-- This migration is idempotent — running twice is safe.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      text NOT NULL,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- When a new token is requested, we invalidate any earlier
  -- unused tokens for the same user via:
  --   UPDATE password_reset_tokens SET used_at = now()
  --     WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
  -- So we add an index that supports that WHERE clause.
  CONSTRAINT password_reset_tokens_token_hash_len
    CHECK (char_length(token_hash) = 64)
);

-- Lookup index: WHERE user_id = $1 AND token_hash = $2
-- (used for token validation against the supplied hash).
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_lookup
  ON password_reset_tokens(user_id, token_hash);

-- Invalidation index: WHERE user_id = $1 AND used_at IS NULL
-- (used when issuing a new token to invalidate prior outstanding ones).
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_unused
  ON password_reset_tokens(user_id)
  WHERE used_at IS NULL;
