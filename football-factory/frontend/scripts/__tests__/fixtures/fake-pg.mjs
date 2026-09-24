import { existsSync, readFileSync, writeFileSync } from "node:fs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class Client {
  constructor(pool) {
    this.pool = pool;
    this.transaction = null;
  }

  async query(sql, values = []) {
    const statement = String(sql).trim();
    this.pool.events.push(statement.split(/\s+/).slice(0, 4).join(" "));

    if (/^BEGIN\s*$/i.test(statement)) {
      this.transaction = clone(this.pool.state);
      return { rows: [], rowCount: 0 };
    }
    if (/^COMMIT\s*$/i.test(statement)) {
      if (!this.transaction) throw new Error("fixture_commit_without_transaction");
      this.pool.state = this.transaction;
      this.transaction = null;
      return { rows: [], rowCount: 0 };
    }
    if (/^ROLLBACK\s*$/i.test(statement)) {
      this.transaction = null;
      return { rows: [], rowCount: 0 };
    }
    if (/CREATE TABLE IF NOT EXISTS ff_schema_migrations/i.test(statement)) {
      return { rows: [], rowCount: 0 };
    }
    if (/^SELECT name FROM ff_schema_migrations/i.test(statement)) {
      return { rows: this.pool.state.history.map((name) => ({ name })), rowCount: this.pool.state.history.length };
    }
    if (/^INSERT INTO ff_schema_migrations/i.test(statement)) {
      if (!this.transaction) throw new Error("fixture_history_insert_outside_transaction");
      this.transaction.history.push(values[0]);
      return { rows: [], rowCount: 1 };
    }

    if (!this.transaction) throw new Error("fixture_migration_outside_transaction");
    for (const match of statement.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) {
      this.transaction.tables.push(match[1]);
    }
    if (/SELECT\s+FAIL_MIGRATION/i.test(statement)) {
      throw new Error("fixture_injected_migration_failure");
    }
    return { rows: [], rowCount: 0 };
  }

  release() {}
}

export class Pool {
  constructor() {
    const stateFile = process.env.FAKE_PG_STATE_FILE;
    if (!stateFile) throw new Error("fixture_state_file_missing");
    this.stateFile = stateFile;
    this.state = existsSync(stateFile)
      ? JSON.parse(readFileSync(stateFile, "utf8"))
      : { history: [], tables: [] };
    this.events = [];
  }

  async connect() {
    return new Client(this);
  }

  async end() {
    writeFileSync(this.stateFile, JSON.stringify({ ...this.state, events: this.events }));
  }
}

export default { Pool };
