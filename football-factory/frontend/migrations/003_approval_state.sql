-- Football Factory — approval state migration (003).
--
-- Adds an explicit `approval_state` column to editorial_items so the
-- human-approval gate is distinguishable from the editorial pipeline
-- stage (which lives in `stage`).
--
-- Also adds a nullable `editorial_item_id` column to automation_runs
-- so a run can deterministically reference the editorial item it is
-- acting on. This addresses the missing run <-> editorial_item linkage
-- documented in the audit:
--
--   RUN_EDITORIAL_LINK = MISSING before this migration.
--   RUN_EDITORIAL_LINK = PRESENT after this migration (nullable FK).
--
-- When `editorial_item_id` is NULL on a run, the publish path refuses
-- to publish ("editorial_link_missing"). This prevents the wp-publish
-- route from guessing the editorial item from wp_post_id metadata.
--
-- Idempotency:
--   - ADD COLUMN IF NOT EXISTS  (safe to re-run)
--   - ADD CONSTRAINT IF NOT EXISTS pattern via pg_constraint check
--     (we use a DO block to add the CHECK only if missing, so re-runs
--     don't fail)
--   - CREATE INDEX IF NOT EXISTS
--
-- No DROP. No DELETE. No destructive ALTER.

BEGIN;

-- 1) editorial_items.approval_state
ALTER TABLE editorial_items
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'pending';

-- Add the CHECK constraint only if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'editorial_items_approval_state_check'
  ) THEN
    ALTER TABLE editorial_items
      ADD CONSTRAINT editorial_items_approval_state_check
      CHECK (approval_state IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- 2) automation_runs.editorial_item_id (nullable FK)
ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS editorial_item_id uuid
    REFERENCES editorial_items(id) ON DELETE SET NULL;

-- 3) index for the most-frequent approval query:
--    WHERE approval_state='pending' ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_editorial_items_approval_state
  ON editorial_items(approval_state, updated_at DESC);

COMMIT;
