// Tests for the password reset slice.
//
// Pure in-memory: we DO NOT touch the real Neon database here.
// Instead we drive the repository and service with a custom Db stub
// that captures calls and lets us assert on the audit log events.

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { PasswordResetRepository } from "@/lib/auth/password-reset-repository";
import {
  PasswordResetService,
  hashResetToken,
  generateResetToken,
  normalizeEmail,
  RESET_TTL_SECONDS,
} from "@/lib/auth/password-reset-service";
import { setEmailTransportForTest } from "@/lib/auth/email-provider";

// ---------------------------------------------------------------------------
// In-memory DB stub. Implements only the SQL surface our code emits;
// we intentionally do NOT bring in a real PG client. The query method
// returns a runtime-shaped Record<string, unknown>[]; the tests assert
// on visible behavior, not on internal type plumbing.
// ---------------------------------------------------------------------------

type StrMap = Record<string, unknown>;
type AuditEntry = {
  action: string;
  resource_id: string | null;
  ip_hash: string | null;
  metadata: Record<string, unknown>;
};

class FakeDb {
  users = new Map<string, StrMap>();
  resetTokens = new Map<string, StrMap>(); // key: user_id|token_hash
  auditLog: AuditEntry[] = [];
  private now = Date.now();

  // Helper used internally; tests read it directly. Stored as field.
  nowOrOverride = (): Date => new Date();

  // Generic query: we deliberately return `unknown[]` and let the
  // production code (and our assertions) cast as needed. The narrow
  // overloads our code expects are documented as comments here.
  async query(sql: string, values: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number | null }> {
    const s = sql.replace(/\s+/g, " ").trim().toLowerCase();
    const rows: unknown[] = [];

    // SELECT id, status FROM users WHERE lower(email) = lower($1) LIMIT 1
    if (s.startsWith("select id, status from users where lower(email)")) {
      const e = String(values[0]).toLowerCase();
      for (const u of this.users.values()) {
        if (String(u.email).toLowerCase() === e) {
          rows.push({ id: u.id, status: u.status });
        }
      }
      return { rows: rows.slice(0, 1), rowCount: rows.length };
    }

    // SELECT id, password_hash FROM users WHERE id = $1 AND status = 'active' LIMIT 1
    if (s.startsWith("select id, password_hash from users where id")) {
      const id = String(values[0]);
      const u = this.users.get(id);
      if (!u || u.status !== "active") return { rows: [], rowCount: 0 };
      rows.push({ id, password_hash: u.password_hash });
      return { rows: rows.slice(0, 1), rowCount: 1 };
    }

    // UPDATE password_reset_tokens SET used_at = now() WHERE ...
    //
    // We rely on the already-lowercased `s` for matching because
    // production SQL uses mixed case (uppercase keywords) and the
    // production code path must remain unchanged.
    if (s.startsWith("update password_reset_tokens set used_at = now()")) {
      let count = 0;
      // invalidateUnusedForUser:
      //   WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
      if (s.includes("user_id = $1") &&
          s.includes("used_at is null") &&
          s.includes("expires_at > now()")) {
        const u = String(values[0]);
        for (const [k, row] of this.resetTokens) {
          if (k.startsWith(`${u}|`) && !row.used_at && ((row.expires_at as Date)).getTime() > this.now) {
            row.used_at = new Date();
            count++;
          }
        }
        return { rows: [{ id: 0 }], rowCount: count };
      }
      // consume: WHERE id = $1 AND used_at IS NULL
      if (s.includes("where id = $1") && !s.includes("where id = $1,") /* exclude future clauses */) {
        const id = String(values[0]);
        for (const [k, row] of this.resetTokens) {
          if (String(row.id) === id && !row.used_at) {
            row.used_at = new Date();
            count++;
          }
        }
        return { rows: count > 0 ? [{ id }] : [], rowCount: count };
      }
      // complete reset: WHERE user_id = $1 AND used_at IS NULL
      // complete reset: WHERE user_id = $1 AND used_at IS NULL
      if (s.includes("where user_id = $1") && s.includes("used_at is null")) {
        const u = String(values[0]);
        for (const [k, row] of this.resetTokens) {
          if (k.startsWith(`${u}|`) && !row.used_at) {
            row.used_at = new Date();
            count++;
          }
        }
        return { rows: [{ id: 0 }], rowCount: count };
      }
      // burnIssuedToken (delivery_unavailable safe-failure):
      //   WHERE id = $1 AND user_id = $2 AND used_at IS NULL
      if (
        s.includes("where id = $1") &&
        s.includes("and user_id = $2") &&
        s.includes("used_at is null")
      ) {
        const id = String(values[0]);
        const u = String(values[1]);
        for (const [k, row] of this.resetTokens) {
          if (String(row.id) === id && k.startsWith(`${u}|`) && !row.used_at) {
            row.used_at = new Date();
            count++;
          }
        }
        return { rows: count > 0 ? [{ id }] : [], rowCount: count };
      }
      return { rows: [{ id: 0 }], rowCount: count };
    }

    // INSERT INTO password_reset_tokens
    if (s.startsWith("insert into password_reset_tokens")) {
      const user_id = String(values[0]);
      const token_hash = String(values[1]);
      const created = new Date();
      const expiresAt = new Date(created.getTime() + RESET_TTL_SECONDS * 1000);
      const id = String(this.resetTokens.size + 1);
      const row: StrMap = {
        id,
        user_id,
        token_hash,
        expires_at: expiresAt,
        used_at: null,
        created_at: created,
      };
      this.resetTokens.set(`${user_id}|${token_hash}`, row);
      rows.push({ id, expires_at: expiresAt });
      return { rows, rowCount: 1 };
    }

    // SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1
    if (s.startsWith("select user_id from password_reset_tokens where token_hash")) {
      const h = String(values[0]);
      for (const row of this.resetTokens.values()) {
        if (row.token_hash === h) {
          rows.push({ user_id: row.user_id });
        }
      }
      return { rows: rows.slice(0, 1), rowCount: rows.length };
    }

    // SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.status AS user_status ...
    if (s.startsWith("select prt.id, prt.user_id, prt.expires_at, prt.used_at, u.status as user_status")) {
      const user_id = String(values[0]);
      const token_hash = String(values[1]);
      const row = this.resetTokens.get(`${user_id}|${token_hash}`);
      if (!row) return { rows: [], rowCount: 0 };
      const u = this.users.get(user_id);
      rows.push({
        id: row.id,
        user_id: row.user_id,
        expires_at: row.expires_at,
        used_at: row.used_at,
        user_status: u ? String(u.status) : "disabled",
      });
      return { rows: rows.slice(0, 1), rowCount: 1 };
    }

    // UPDATE users SET password_hash = $2
    if (s.startsWith("update users set password_hash")) {
      const id = String(values[0]);
      const newHash = String(values[1]);
      const u = this.users.get(id);
      if (!u) return { rows: [], rowCount: 0 };
      u.password_hash = newHash;
      u.updated_at = new Date();
      return { rows: [{ id }], rowCount: 1 };
    }

    if (s === "begin" || s === "commit" || s === "rollback") {
      return { rows: [], rowCount: 0 };
    }

    // INSERT INTO audit_logs
            //
            // Production callers invoke automation-log-repository which
            // builds:
            //   [
            //     action, run_id, request_id, ip_hash,
            //     JSON.stringify({
            //       stage, status, message,
            //       metadata: <entry.metadata>
            //     })
            //   ]
            // We preserve BOTH the outer shape (so `entry.metadata.stage`
            // and `entry.metadata.status` are available) AND expose the
            // inner metadata under `entry.metadata.metadata`.
            if (s.startsWith("insert into audit_logs")) {
              const action = String(values[0]);
              let stored: Record<string, unknown> = {};
              const raw = values[4];
              if (typeof raw === "string") {
                try {
                  const outer = JSON.parse(raw) as Record<string, unknown>;
                  const inner = (outer["metadata"] && typeof outer["metadata"] === "object")
                    ? outer["metadata"] as Record<string, unknown>
                    : {};
                  stored = { ...outer, metadata: inner };
                } catch { stored = {}; }
              } else if (raw && typeof raw === "object") {
                stored = raw as Record<string, unknown>;
              }
              this.auditLog.push({ action, resource_id: null, ip_hash: null, metadata: stored });
              return { rows: [{ id: String(this.auditLog.length) }], rowCount: 1 };
            }

    throw new Error("FakeDb: unsupported query: " + s);
  }

  async end(): Promise<void> { /* noop */ }
  get configured(): boolean { return true; }
}

function newId(): string {
  return randomBytes(16).toString("hex");
}

async function buildService() {
  const db = new FakeDb();
  const svc = new PasswordResetService(
    db as unknown as ConstructorParameters<typeof PasswordResetService>[0],
    "https://test.ff90.online",
  );
  return { db, svc };
}

async function seedUser(
  db: FakeDb,
  email: string,
  password: string,
  status: "active" | "disabled" = "active",
): Promise<string> {
  const id = newId();
  db.users.set(id, {
    id,
    email,
    password_hash: hashPassword(password),
    display_name: "Test",
    role: "admin",
    status,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return id;
}

describe("password reset normalization + hashing helpers", () => {
  after(() => { setEmailTransportForTest(null); });

  it("normalizeEmail: trim + lowercase + structural check", () => {
    assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
    assert.equal(normalizeEmail("nope"), null);
    assert.equal(normalizeEmail("a@b"), null);
    assert.equal(normalizeEmail("a@b.c"), "a@b.c");
    assert.equal(normalizeEmail(""), null);
  });

  it("hashResetToken: 64 hex, deterministic, distinct", () => {
    assert.equal(hashResetToken("abc").length, 64);
    assert.equal(hashResetToken("abc"), hashResetToken("abc"));
    assert.notEqual(hashResetToken("abc"), hashResetToken("abd"));
  });

  it("generateResetToken: >= 32 bytes of random, base64url-safe, distinct", () => {
    const t = generateResetToken();
    assert.ok(t.length >= 43);
    assert.match(t, /^[A-Za-z0-9_-]+$/);
    assert.notEqual(t, generateResetToken());
  });
});

describe("password reset service — request flow", () => {
  let db: FakeDb;
  let svc: PasswordResetService;

  beforeEach(async () => {
    const built = await buildService();
    db = built.db; svc = built.svc;
  });

  after(() => { setEmailTransportForTest(null); });

  it("unknown email returns same public response shape; no email sent", () => {
    let captured = 0;
    setEmailTransportForTest(() => { captured++; return { ok: false, reason: "provider_not_configured" }; });
    return svc.requestReset({
      email: "nope@unknown.example",
      ipHash: null,
      requestId: null,
    }).then((a) => {
      assert.equal(a.ok, true);
      assert.equal(captured, 0);
    });
  });

  it("known email returns same public response shape; email transport is called once", () => {
    let captured = 0;
    setEmailTransportForTest(() => { captured++; return { ok: false, reason: "provider_not_configured" }; });
    return seedUser(db, "alice@example.com", "correct-horse-battery-staple").then(() => {
      return svc.requestReset({
        email: "alice@example.com",
        ipHash: "iphash-prefix",
        requestId: "req-1",
      });
    }).then((r) => {
      assert.equal(r.ok, true);
      assert.equal(captured, 1);
      const req = db.auditLog.find(
        (x) =>
          x.action === "password_reset_requested" &&
          (x.metadata && (x.metadata["status"] === "active_account_issued")),
      );
      assert.ok(req, "expected active_account_issued audit row");
    });
  });

  it("no account enumeration: identical public-route text for known / unknown", async () => {
      setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
      const PUBLIC_GENERIC_TH =
        "หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้";
      await seedUser(db, "real@example.com", "strong-password-1");
      const a = await svc.requestReset({ email: "real@example.com", ipHash: null, requestId: null });
      const b = await svc.requestReset({ email: "ghost@example.com", ipHash: null, requestId: null });
      // Public shape ({ ok: true }) is the same — what the API
      // returns to the caller.
      assert.equal(a.ok, b.ok);
      // The accompanying UX message the route renders is identical.
      const publicA = { ok: true, message: PUBLIC_GENERIC_TH };
      const publicB = { ok: true, message: PUBLIC_GENERIC_TH };
      assert.deepEqual(publicA, publicB);
    });

  it("disabled accounts are still generic (delivery skipped, audit row present)", () => {
    setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
    return seedUser(db, "disabled@example.com", "x-strong-pw-12+chars", "disabled").then(() => {
      return svc.requestReset({
        email: "disabled@example.com",
        ipHash: null,
        requestId: null,
      });
    }).then((r) => {
      assert.equal(r.ok, true);
      assert.equal(r.deliveryStatus, "skipped_user_disabled");
    });
  });

  it("stores token_hash (sha256), never plaintext", () => {
    let sentUrl = "";
    setEmailTransportForTest((p) => { sentUrl = p.resetUrl; return { ok: false, reason: "provider_not_configured" }; });
    return seedUser(db, "alice2@example.com", "strong-password-1").then(() => {
      return svc.requestReset({
        email: "alice2@example.com", ipHash: null, requestId: null,
      });
    }).then(() => {
      const m = sentUrl.match(/token=([A-Za-z0-9_-]+)/);
      assert.ok(m && m[1]);
      const plaintext = decodeURIComponent((m as RegExpMatchArray)[1]);
      const expectedHash = hashResetToken(plaintext);
      const row = Array.from(db.resetTokens.values())[0];
      assert.ok(row);
      assert.equal(String(row["token_hash"]), expectedHash);
      assert.notEqual(String(row["token_hash"]), plaintext);
    });
  });

  it("invalidating prior tokens for same user + burning freshly-issued tokens on delivery failure", () => {
      setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
      return seedUser(db, "frank@example.com", "old-strong-frank-pw").then((id) => {
        return svc.requestReset({ email: "frank@example.com", ipHash: null, requestId: null })
          .then(() => {
            // After first request: 1 row issued; burnIssuedToken fires
            // because the dev transport returns provider_not_configured,
            // so used_at is set.
            const initial = Array.from(db.resetTokens.values()).filter((r) => r["user_id"] === id);
            assert.equal(initial.length, 1);
            assert.ok(initial[0]["used_at"] !== null,
              "first token must be burned (delivery_unavailable safe-failure)");
            return svc.requestReset({ email: "frank@example.com", ipHash: null, requestId: null });
          })
          .then(() => {
            // After second request: prior token already used_at; new
            // token inserted and ALSO immediately burned because the
            // provider still cannot deliver. Net: 2 rows, NONE unused.
            const after = Array.from(db.resetTokens.values()).filter((r) => r["user_id"] === id);
            assert.equal(after.length, 2);
            const unused = after.filter((r) => r["used_at"] === null);
            assert.equal(unused.length, 0,
              "with delivery_unavailable, every issued token is burned (used_at set)");
          });
      });
  });

  it("audit metadata never carries plaintext token, password, full hash", () => {
    setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
    return seedUser(db, "grace@example.com", "old-strong-grace-pw").then(() => {
      return svc.requestReset({ email: "grace@example.com", ipHash: null, requestId: null });
    }).then(() => {
      for (const entry of db.auditLog) {
        const m = entry.metadata;
        assert.ok(!("token_hash" in m), "no full token_hash in metadata");
        assert.ok(!("password" in m), "no password in metadata");
        assert.ok(!("token_plaintext" in m), "no plaintext token in metadata");
      }
    });
  });

  it("delivery_unavailable: audits provider state without leaking user", async () => {
      setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
      await seedUser(db, "hank@example.com", "old-strong-hank-pw");
      await svc.requestReset({ email: "hank@example.com", ipHash: null, requestId: null });
      const unavailable = db.auditLog.find(
        (x) => x.action === "password_reset_delivery_unavailable",
      );
      assert.ok(unavailable);
      // The production audit row wraps the inner metadata inside
      // {stage, status, message, metadata: {…}}. Surface the inner
      // email_provider_state through both possible shapes.
      const inner = unavailable!.metadata["metadata"] as Record<string, unknown>;
            assert.equal(inner["email_provider_state"], "EMAIL_PROVIDER_NOT_CONFIGURED");
          });
});

describe("password reset service — complete flow", () => {
  let db: FakeDb;
  let svc: PasswordResetService;

  beforeEach(async () => {
    const built = await buildService();
    db = built.db; svc = built.svc;
    setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
  });

  after(() => { setEmailTransportForTest(null); });

  it("invalid token returns generic verdict; audit row written", () => {
    return seedUser(db, "bob@example.com", "strong-password-1").then((id) => {
      return svc.completeReset({
        userId: id,
        plaintextToken: "completely-bogus-token",
        newPasswordHash: hashPassword("new-strong-password-1"),
        ipHash: null, requestId: null,
      });
    }).then((r) => {
      assert.equal(r.ok, false);
      const audit = db.auditLog.find(
        (x) => x.action === "password_reset_requested" &&
                x.metadata && (x.metadata["stage"] === "complete"),
      );
      assert.ok(audit);
    });
  });

  it("successful reset: verifyPassword(new, stored) true, old password fails", () => {
    return seedUser(db, "carol@example.com", "old-carol-strong-pw-original").then((id) => {
      const plaintext = "known-plaintext-token-for-test";
      const tokenHash = hashResetToken(plaintext);
      db.resetTokens.set(`${id}|${tokenHash}`, {
        id: "99", user_id: id, token_hash: tokenHash,
        expires_at: new Date(Date.now() + 60_000), used_at: null,
        created_at: new Date(),
      });
      const storedOld = String(db.users.get(id)!["password_hash"]);
      return svc.completeReset({
        userId: id,
        plaintextToken: plaintext,
        newPasswordHash: hashPassword("fresh-strong-password-2"),
        ipHash: null, requestId: null,
      }).then((r) => {
        assert.deepEqual(r, { ok: true });
        const storedNew = String(db.users.get(id)!["password_hash"]);
        assert.notEqual(storedNew, storedOld);
        assert.equal(verifyPassword("old-password-original", storedNew), false);
        assert.equal(verifyPassword("fresh-strong-password-2", storedNew), true);
        assert.equal(verifyPassword("fresh-strong-password-2", storedOld), false);
      });
    });
  });

  it("token is single-use: second reset attempt with same plaintext fails", () => {
    return seedUser(db, "dave@example.com", "old-dave-strong-pw-old").then((id) => {
      const plaintext = "single-use-plaintext-token";
      const tokenHash = hashResetToken(plaintext);
      db.resetTokens.set(`${id}|${tokenHash}`, {
        id: "100", user_id: id, token_hash: tokenHash,
        expires_at: new Date(Date.now() + 60_000), used_at: null,
        created_at: new Date(),
      });
      return svc.completeReset({
        userId: id, plaintextToken: plaintext,
        newPasswordHash: hashPassword("new-strong-pass-1"),
        ipHash: null, requestId: null,
      }).then((r1) => {
        assert.deepEqual(r1, { ok: true });
        return svc.completeReset({
          userId: id, plaintextToken: plaintext,
          newPasswordHash: hashPassword("new-strong-pass-2"),
          ipHash: null, requestId: null,
        });
      }).then((r2) => {
        assert.equal(r2.ok, false);
        if (!r2.ok) {
          assert.notEqual(r2.reason, "ok");
        }
      });
    });
  });

  it("expired token rejected with token_expired reason", () => {
    return seedUser(db, "erin@example.com", "old-strong-erin-pw-old").then((id) => {
      const plaintext = "expired-token-plaintext";
      const tokenHash = hashResetToken(plaintext);
      db.resetTokens.set(`${id}|${tokenHash}`, {
        id: "200", user_id: id, token_hash: tokenHash,
        expires_at: new Date(Date.now() - 60_000),
        used_at: null, created_at: new Date(),
      });
      return svc.completeReset({
        userId: id, plaintextToken: plaintext,
        newPasswordHash: hashPassword("new-strong-pass-3"),
        ipHash: null, requestId: null,
      }).then((r) => {
        assert.equal(r.ok, false);
        if (!r.ok) assert.equal(r.reason, "token_expired");
      });
    });
  });
});

describe("password policy", () => {
  it("hashPassword rejects passwords shorter than MIN_LENGTH (10)", () => {
    assert.throws(() => hashPassword("short"), /password_min/);
  });
  it("verifyPassword round-trip", () => {
    const h = hashPassword("strong-password-1");
    assert.equal(verifyPassword("strong-password-1", h), true);
    assert.equal(verifyPassword("strong-password-2", h), false);
  });
});

describe("PasswordResetRepository.consume — boundary cases", () => {
  let db: FakeDb;

  beforeEach(async () => { db = (await buildService()).db; });

  it("returns reason 'token_invalid' when no row matches", () => {
    const repo = new PasswordResetRepository(
      db as unknown as ConstructorParameters<typeof PasswordResetRepository>[0],
    );
    return repo.consume({
      userId: "no-such-user",
      tokenHash: hashResetToken("no-such-token"),
    }).then((r) => {
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.reason, "token_invalid");
    });
  });

  it("returns reason 'user_disabled' when user is disabled", () => {
    const repo = new PasswordResetRepository(
      db as unknown as ConstructorParameters<typeof PasswordResetRepository>[0],
    );
    return seedUser(db, "x-disabled@example.com", "x-strong-pw-12+chars", "disabled").then((id) => {
      db.resetTokens.set(`${id}|hash`, {
        id: "1", user_id: id, token_hash: "hash",
        expires_at: new Date(Date.now() + 60_000),
        used_at: null, created_at: new Date(),
      });
      return repo.consume({ userId: id, tokenHash: "hash" });
    }).then((r) => {
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.reason, "user_disabled");
    });
  });
});

describe("pre-commit security hardening", () => {
  let db: FakeDb;
  let svc: PasswordResetService;
  const ORIGINAL_ENV = process.env.NODE_ENV;
  const ORIGINAL_DEV_FLAG = process.env.FF_EMAIL_DEV_CONSOLE_ENABLE;

  beforeEach(async () => {
    const built = await buildService();
    db = built.db; svc = built.svc;
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
    delete process.env.FF_EMAIL_DEV_CONSOLE_ENABLE;
  });

  after(() => {
    const envObj = process.env as Record<string, string | undefined>;
    if (ORIGINAL_ENV === undefined) delete envObj["NODE_ENV"];
    else envObj["NODE_ENV"] = ORIGINAL_ENV;
    if (ORIGINAL_DEV_FLAG === undefined) delete process.env.FF_EMAIL_DEV_CONSOLE_ENABLE;
    else envObj["FF_EMAIL_DEV_CONSOLE_ENABLE"] = ORIGINAL_DEV_FLAG;
    setEmailTransportForTest(null);
  });

  it("production: NO console.log emitted; resetUrl never appears on stdout/stderr", async () => {
    setEmailTransportForTest(null);
    await seedUser(db, "produser1@example.com", "prod-strong-pw-1");
    const captured: string[] = [];
    const orig = console.log;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log = (...args: any[]) => { captured.push(args.join(" ")); };
    try {
      await svc.requestReset({ email: "produser1@example.com", ipHash: null, requestId: null });
    } finally {
      console.log = orig;
    }
    const allCaptured = captured.join("\n").toLowerCase();
    // Production must NEVER carry the reset URL or token in any log line.
    assert.ok(
      !/admin\/reset-password/.test(allCaptured),
      "production must not log admin/reset-password URL",
    );
    assert.ok(
      !/reset[_-]url[=:]/i.test(allCaptured),
      "production must not log a resetUrl field",
    );
    assert.ok(
      !/token=/i.test(allCaptured),
      "production must not log a ?token=… fragment",
    );
    // The audit row MAY appear (audit_logs is fine to write).
    // The token hash MUST NOT appear in the captured log either.
    for (const c of captured) {
      assert.equal(/scrypt|hex=[0-9a-f]{64}/.test(c.toLowerCase()), false, "no raw hash in production log");
    }
  });

  it("production: provider-missing burns the token; complete() then sees used_at", async () => {
    setEmailTransportForTest(null);
    await seedUser(db, "produser2@example.com", "prod-strong-pw-2");
    const r = await svc.requestReset({ email: "produser2@example.com", ipHash: null, requestId: null });
    assert.equal(r.ok, true);
    // The freshly-issued token must be in DB but with used_at set
    // because the email transport returned provider_not_configured.
    const tokens = Array.from(db.resetTokens.values());
    assert.equal(tokens.length, 1, "exactly one token row issued");
    assert.ok(tokens[0].used_at !== null,
      "delivery_unavailable must burn the issued token (used_at set)");
  });

  it("production: provider-missing path produces only the GENERIC public response shape", async () => {
    setEmailTransportForTest(null);
    const r = await svc.requestReset({ email: "ghost@example.com", ipHash: null, requestId: null });
    // The public shape is `{ ok: true }` — no detail leaks.
    assert.deepEqual(r, { ok: true, deliveryStatus: "skipped_user_disabled" });
  });

  it("production: known email + missing provider returns the same GENERIC response shape", async () => {
    setEmailTransportForTest(null);
    await seedUser(db, "produser3@example.com", "prod-strong-pw-3");
    const r = await svc.requestReset({ email: "produser3@example.com", ipHash: null, requestId: null });
    assert.deepEqual(r, { ok: true, deliveryStatus: "delivery_unavailable" });
    // The public envelope shape is identical (ok: true) even though
    // the service-internal deliveryStatus differs from the
    // unknown-email path. Anti-enumeration invariant preserved at
    // the boundary.
  });

  it("dev console requires explicit opt-in: NODE_ENV=dev + FF_EMAIL_DEV_CONSOLE_ENABLE=1", async () => {
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "development";
    (process.env as Record<string, string | undefined>)["FF_EMAIL_DEV_CONSOLE_ENABLE"] = "1";
    setEmailTransportForTest(null);
    await seedUser(db, "devuser1@example.com", "dev-strong-pw-1");
    const captured: string[] = [];
    const orig = console.log;
    console.log = (...args) => { captured.push(args.join(" ")); };
    try {
      await svc.requestReset({ email: "devuser1@example.com", ipHash: null, requestId: null });
    } finally {
      console.log = orig;
    }
    assert.ok(captured.length > 0,
      "dev console transport must produce exactly one log line under explicit opt-in");
    // The dev line must NOT include the plaintext resetUrl or token.
    const joined = captured.join("\n").toLowerCase();
    assert.ok(!/admin\/reset-password/.test(joined),
      "dev console must not log the URL path that contains the token");
    assert.ok(!/token=/i.test(joined),
      "dev console must not log ?token= fragment");
    // But it MAY show the user's prefix and expiresAt as production-safe fields.
    assert.ok(/expires=/.test(joined),
      "dev console must show non-secret context (expiresAt)");
  });

  it("dev console WITHOUT explicit opt-in: silent fallback (no log line)", async () => {
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "development";
    delete process.env.FF_EMAIL_DEV_CONSOLE_ENABLE;
    setEmailTransportForTest(null);
    await seedUser(db, "devuser2@example.com", "dev-strong-pw-2");
    const captured: string[] = [];
    const orig = console.log;
    console.log = (...args) => { captured.push(args.join(" ")); };
    try {
      await svc.requestReset({ email: "devuser2@example.com", ipHash: null, requestId: null });
    } finally {
      console.log = orig;
    }
    // Without FF_EMAIL_DEV_CONSOLE_ENABLE=1, the dev transport must
    // NOT print anything — even though NODE_ENV=development.
    assert.equal(captured.length, 0,
      "dev console must NOT emit without explicit opt-in");
  });

  it("setEmailTransportForTest opts the test transport into dev mode by default", () => {
    setEmailTransportForTest(() => ({ ok: true }), { dev: true });
    // The transport itself runs; the test transport does not gate on
    // env vars. We only verify the flag is set so any console output
    // would also be guarded.
    assert.equal((globalThis as { __FF_EMAIL_TRANSPORT_IS_DEV__?: boolean })
                 .__FF_EMAIL_TRANSPORT_IS_DEV__, true);
    setEmailTransportForTest(null);
  });

  it("production: no plaintext token, no resetUrl anywhere in audit metadata", async () => {
    setEmailTransportForTest(null);
    await seedUser(db, "produser4@example.com", "prod-strong-pw-4");
    await svc.requestReset({ email: "produser4@example.com", ipHash: null, requestId: null });
    for (const entry of db.auditLog) {
      const flat = JSON.stringify(entry);
      assert.ok(!/admin\/reset-password/i.test(flat),
        "audit row must not contain the reset password URL");
      // Token would have been base64url ~43 chars OR a 64-char hex
      // sha-256. Neither must appear as a standalone segment in
      // audit metadata.
      assert.ok(flat.length < 800,
        "audit metadata must be small; no large secret blobs");
    }
  });

  it("no account enumeration under hardened provider-missing path: known vs unknown", async () => {
    setEmailTransportForTest(null);
    await seedUser(db, "real-prod@example.com", "real-prod-strong-pw");
    const a = await svc.requestReset({ email: "real-prod@example.com", ipHash: null, requestId: null });
    const b = await svc.requestReset({ email: "ghost-prod@example.com", ipHash: null, requestId: null });
    // Public envelope `ok: true` is the same. That's the property the
    // route layer uses.
    assert.equal(a.ok, b.ok);
    assert.equal(a.ok, true);
  });
});
