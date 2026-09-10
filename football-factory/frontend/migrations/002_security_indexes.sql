-- Football Factory — supporting indexes (FIRST SLICE)
--
-- Adds 3 read-path indexes that are not strictly required by the schema
-- but reduce latency for the most-frequent queries:
--
--   - users(role, status)            for role-list views in admin guard
--   - automation_runs(status, started_at DESC) for run-log views
--   - favorites(user_id, created_at DESC) for per-user favorites lists

BEGIN;

CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users(role, status);

CREATE INDEX IF NOT EXISTS idx_automation_status_started
  ON automation_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON favorites(user_id, created_at DESC);

COMMIT;
