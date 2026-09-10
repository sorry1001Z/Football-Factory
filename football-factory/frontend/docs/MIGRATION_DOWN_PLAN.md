# Migration DOWN Plan (FIRST SLICE)

This document describes the irreversible steps for rolling back the
`001_application_data.sql` and `002_security_indexes.sql` migrations.

**IMPORTANT**: PG does not support transactional DDL rollback reliably
for `CREATE EXTENSION`. The DOWN plan is **NOT** an embedded part of the
migration SQL. It is a separate document that operators read and execute
manually ONLY if a rollback is required.

**No down-migration script is provided in this slice** because we are not
running the migrations against production yet. The first production run
will use the up-migration. Down-migrations will be added in a later
slice if/when production data is in place.

## DOWN order (manual, destructive)

Run each step ONLY if the corresponding up-step completed.

1. `DROP INDEX IF EXISTS idx_favorites_user;`
2. `DROP INDEX IF EXISTS idx_automation_status_started;`
3. `DROP INDEX IF EXISTS idx_users_role_status;`
4. `DROP TABLE IF EXISTS analytics_events CASCADE;`
5. `DROP TABLE IF EXISTS seo_audits CASCADE;`
6. `DROP TABLE IF EXISTS audit_logs CASCADE;`
7. `DROP TABLE IF EXISTS automation_runs CASCADE;`
8. `DROP TABLE IF EXISTS editorial_items CASCADE;`
9. `DROP TABLE IF EXISTS notifications CASCADE;`
10. `DROP TABLE IF EXISTS notification_preferences CASCADE;`
11. `DROP TABLE IF EXISTS comments CASCADE;`
12. `DROP TABLE IF EXISTS favorites CASCADE;`
13. `DROP TABLE IF EXISTS users CASCADE;`
14. `DROP EXTENSION IF EXISTS pgcrypto;` — only if no other application
    uses it. PG cannot DROP EXTENSION if any object depends on
    `gen_random_uuid()`. Verify first.

## First-admin creation

The up-migration does NOT seed an admin user. To create the first admin
after running the up-migration, the operator must:

1. Pick a strong password (≥ 10 chars).
2. Hash it locally with the same scrypt parameters used by
   `lib/auth/password.ts`:

   ```bash
   node -e '
     const c = require("node:crypto");
     const salt = c.randomBytes(16).toString("hex");
     const hash = Buffer.from(c.scryptSync(process.argv[1], salt, 64)).toString("hex");
     console.log(`scrypt$${salt}$${hash}`);
   ' "<password>"
   ```

3. Insert the row directly with the returned `scrypt$<salt>$<hash>`:

   ```sql
   INSERT INTO users (email, password_hash, display_name, role)
   VALUES ('admin@example.com', 'scrypt$<salt>$<hash>', 'Site Admin', 'admin');
   ```

The Application Password in WordPress and the `AUTH_SECRET` env var
must be issued separately.

## Idempotency note

The up-migrations are idempotent (`CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS` inside a
`DO $$ ... EXCEPTION` block). Running them twice is safe and produces
the same end state. This is verified by the structural test in
`tests/unit/migration-shape.test.ts` (added in this slice).

## When the FIRST slice is complete

After Postgres + WP Application Password + n8n are provisioned, the
operator should:

1. Run `npm run migrate -- --file migrations/001_application_data.sql`
   against the staging DB.
2. Run `npm run migrate -- --file migrations/002_security_indexes.sql`.
3. Verify schema via `\dt` in psql.
4. Run `npm run migrate` again to confirm idempotency (no errors).
5. Create the first admin via the manual procedure above.
