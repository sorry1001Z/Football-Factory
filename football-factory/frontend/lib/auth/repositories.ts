// Football Factory — repositories (FIRST SLICE).
//
// Server-only thin wrappers around the application DB. All queries are
// parameterized; no string interpolation. Errors are surfaced as
// PostgresError so callers can discriminate.

import "server-only";
import type { Db } from "@/lib/db/postgres";
import type { Role, User, UserWithPassword } from "./contracts";

export class UserRepository {
  constructor(private db: Db) {}

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const r = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: Role;
      status: "active" | "disabled";
      password_hash: string;
    }>(
      `SELECT id, email, display_name, role, status, password_hash
         FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1`,
      [email],
    );
    const x = r.rows[0];
    if (!x) return null;
    return {
      id: x.id,
      email: x.email,
      display_name: x.display_name,
      role: x.role,
      status: x.status,
      password_hash: x.password_hash,
    };
  }

  async findById(id: string): Promise<User | null> {
    const r = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: Role;
      status: "active" | "disabled";
    }>(
      `SELECT id, email, display_name, role, status FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    const x = r.rows[0];
    if (!x) return null;
    return {
      id: x.id,
      email: x.email,
      display_name: x.display_name,
      role: x.role,
      status: x.status,
    };
  }

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role?: Role;
  }): Promise<User> {
    const r = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: Role;
      status: "active" | "disabled";
    }>(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, role, status`,
      [
        input.email,
        input.passwordHash,
        input.displayName,
        input.role ?? "member",
      ],
    );
    const x = r.rows[0];
    return {
      id: x.id,
      email: x.email,
      display_name: x.display_name,
      role: x.role,
      status: x.status,
    };
  }

  async setRole(id: string, role: Role): Promise<void> {
    await this.db.query(
      `UPDATE users SET role = $2, updated_at = now() WHERE id = $1`,
      [id, role],
    );
  }

  async setStatus(id: string, status: "active" | "disabled"): Promise<void> {
    await this.db.query(
      `UPDATE users SET status = $2, updated_at = now() WHERE id = $1`,
      [id, status],
    );
  }
}

export class AutomationRunRepository {
  constructor(private db: Db) {}

  /**
   * Idempotent insert. Returns:
   *   {inserted: true, run_id}  if this idempotency_key is new.
   *   {inserted: false, run_id} if a run with this key already exists.
   *
   * The UNIQUE constraint on `idempotency_key` enforces this at the DB
   * level. A duplicate-key error (PostgresError kind=CONSTRAINT) is
   * converted to a duplicate-return, not a 500. Concurrent submissions
   * are serialized by the constraint.
   */
  async claim(input: {
    idempotency_key: string;
    workflow: string;
    payload: unknown;
  }): Promise<{ inserted: boolean; run_id: string }> {
    try {
      const r = await this.db.query<{ id: string }>(
        `INSERT INTO automation_runs (idempotency_key, workflow, status, input)
         VALUES ($1, $2, 'running', $3::jsonb)
         RETURNING id`,
        [input.idempotency_key, input.workflow, JSON.stringify(input.payload ?? {})],
      );
      return { inserted: true, run_id: r.rows[0].id };
    } catch (err) {
      // PostgresError kind=CONSTRAINT with code 23505 = unique_violation.
      if (
        err &&
        typeof err === "object" &&
        (err as { name?: string }).name === "PostgresError" &&
        (err as { kind?: string }).kind === "CONSTRAINT"
      ) {
        const existing = await this.db.query<{ id: string }>(
          `SELECT id FROM automation_runs WHERE idempotency_key = $1 LIMIT 1`,
          [input.idempotency_key],
        );
        const row = existing.rows[0];
        if (!row) {
          // Should be impossible: the constraint fired but the row is
          // not visible. Treat as a hard error.
          throw new Error("dedupe_race_unresolved");
        }
        return { inserted: false, run_id: row.id };
      }
      throw err;
    }
  }

  async setStatus(
    run_id: string,
    status: "running" | "success" | "failed" | "waiting_approval" | "rejected",
    output?: unknown,
    error?: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE automation_runs
          SET status = $2,
              output = COALESCE($3::jsonb, output),
              error = COALESCE($4, error),
              finished_at = CASE WHEN $2 IN ('success','failed','rejected') THEN now() ELSE finished_at END
        WHERE id = $1`,
      [
        run_id,
        status,
        output === undefined ? null : JSON.stringify(output),
        error ?? null,
      ],
    );
  }

  async get(run_id: string): Promise<{
    id: string;
    status: string;
    input: unknown;
    output: unknown;
    idempotency_key: string;
  } | null> {
    const r = await this.db.query<{
      id: string;
      status: string;
      input: unknown;
      output: unknown;
      idempotency_key: string;
    }>(
      `SELECT id, status, input, output, idempotency_key
         FROM automation_runs
        WHERE id = $1
        LIMIT 1`,
      [run_id],
    );
    return r.rows[0] ?? null;
  }
}
