-- Phase 19: durable run lifecycle, operator recovery queue, and draft write guard.
-- This migration is source-only in this batch. Apply it through the normal
-- reviewed migration process before deploying routes that use these columns.

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS error_class text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS recovery_count integer NOT NULL DEFAULT 0;

-- Existing rows predate updated_at; preserve their known lifecycle time so
-- old `running` records are detectable as interrupted immediately.
UPDATE automation_runs
   SET updated_at = COALESCE(finished_at, started_at, updated_at);

ALTER TABLE automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_status_check;
ALTER TABLE automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_status_phase19_check;

ALTER TABLE automation_runs
  ADD CONSTRAINT automation_runs_status_phase19_check
  CHECK (status IN (
    'running', 'draft_creating', 'held_for_content', 'recovery_queued',
    'success', 'failed', 'waiting_approval', 'rejected'
  ));

CREATE INDEX IF NOT EXISTS idx_automation_runs_stale
  ON automation_runs(status, updated_at)
  WHERE status IN ('running', 'draft_creating', 'recovery_queued');

CREATE TABLE IF NOT EXISTS automation_run_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES automation_runs(id),
  editorial_item_id uuid NOT NULL REFERENCES editorial_items(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'claimed', 'completed', 'refused', 'expired')),
  from_status text NOT NULL,
  resume_stage text NOT NULL,
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 3),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_run_recoveries_active
  ON automation_run_recoveries(run_id)
  WHERE status IN ('queued', 'claimed');

CREATE INDEX IF NOT EXISTS idx_automation_run_recoveries_queue
  ON automation_run_recoveries(status, available_at, created_at)
  WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS wp_draft_operations (
  run_id uuid PRIMARY KEY REFERENCES automation_runs(id),
  editorial_item_id uuid REFERENCES editorial_items(id),
  status text NOT NULL CHECK (status IN ('started', 'created', 'uncertain', 'failed')),
  wp_post_id bigint,
  error_class text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'created') OR wp_post_id IS NOT NULL)
);
