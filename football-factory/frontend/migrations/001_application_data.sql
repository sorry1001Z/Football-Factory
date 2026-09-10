-- Football Factory — application data schema (FIRST SLICE)
--
-- This is the application database. WordPress remains the content
-- database (articles, categories, tags, media). This DB stores
-- application-only data: users, favorites, comments, notifications,
-- editorial workflow, automation runs, audit logs, SEO audits,
-- analytics events.
--
-- Migration is idempotent — every CREATE uses IF NOT EXISTS. Running
-- this migration twice is safe.
--
-- Required PG extensions:
--   pgcrypto  (gen_random_uuid)
--
-- Down-migration plan is documented in docs/MIGRATION_DOWN_PLAN.md
-- (kept as a separate file, not embedded in SQL, because PG does not
-- support transactional DDL rollback reliably for CREATE EXTENSION).

BEGIN;

-- pgcrypto provides gen_random_uuid(). CREATE EXTENSION cannot run
-- inside a transaction in older PG; PG 13+ allows it. We try and
-- tolerate failure if the extension already exists OR the role lacks
-- superuser; the caller can pre-install the extension manually if
-- needed.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
    RAISE NOTICE 'pgcrypto not auto-installed; assume pre-installed';
  END;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin','editor','author','member')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'post',
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type, external_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  article_external_id text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','spam')),
  moderated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  editorial boolean NOT NULL DEFAULT true,
  comments boolean NOT NULL DEFAULT true,
  system boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editorial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL UNIQUE,
  wp_post_id bigint,
  stage text NOT NULL DEFAULT 'ingested',
  fact_check_score integer,
  seo_score integer,
  rights_confirmed boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE constraint enforces durable idempotency at the DB level.
  -- The /api/automation/deduplicate endpoint relies on this for
  -- concurrent-submission correctness.
  idempotency_key text NOT NULL UNIQUE,
  workflow text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('running','success','failed','waiting_approval','rejected')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  request_id text,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_audits (
  id bigserial PRIMARY KEY,
  content_external_id text NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  path text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
