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
import {
  setEmailTransportForTest,
  sendResetEmail,
  renderResetEmailText,
  renderResetEmailHtml,
  providerKind,
} from "@/lib/auth/email-provider";

type StrMap = Record<string, unknown>;
type AuditEntry = { action: string; metadata: Record<string, unknown> };

class FakeDb {
  users = new Map<string, StrMap>();
  resetTokens = new Map<string, StrMap>();
  auditLog: AuditEntry[] = [];

  async query(sql: string, values: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number | null }> {
    const s = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (s.startsWith("select id, status from users where lower(email)")) {
      const e = String(values[0]).toLowerCase();
      const rows: unknown[] = [];
      for (const u of this.users.values())
        if (String(u["email"]).toLowerCase() === e) rows.push({ id: u["id"], status: u["status"] });
      return { rows: rows.slice(0, 1), rowCount: rows.length };
    }
    if (s.startsWith("update password_reset_tokens set used_at = now()")) {
      let count = 0;
      if (s.includes("user_id = $1") && s.includes("used_at is null") && s.includes("expires_at > now()")) {
        const u = String(values[0]);
        for (const [k, row] of this.resetTokens) {
          if (k.startsWith(`${u}|`) && !row["used_at"]
              && ((row["expires_at"] as Date)).getTime() > Date.now()) {
            row["used_at"] = new Date(); count++;
          }
        }
        return { rows: [{ id: 0 }], rowCount: count };
      }
      if (s.includes("where id = $1") && !s.includes("and user_id = $2")) {
        const id = String(values[0]);
        for (const [, row] of this.resetTokens)
          if (String(row["id"]) === id && !row["used_at"]) { row["used_at"] = new Date(); count++; }
        return { rows: count > 0 ? [{ id }] : [], rowCount: count };
      }
      if (s.includes("where id = $1") && s.includes("and user_id = $2") && s.includes("used_at is null")) {
        const id = String(values[0]);
        const u = String(values[1]);
        for (const [k, row] of this.resetTokens)
          if (String(row["id"]) === id && k.startsWith(`${u}|`) && !row["used_at"]) {
            row["used_at"] = new Date(); count++;
          }
        return { rows: count > 0 ? [{ id }] : [], rowCount: count };
      }
      if (s.includes("where user_id = $1") && s.includes("used_at is null")) {
        const u = String(values[0]);
        for (const [k, row] of this.resetTokens)
          if (k.startsWith(`${u}|`) && !row["used_at"]) { row["used_at"] = new Date(); count++; }
        return { rows: [{ id: 0 }], rowCount: count };
      }
      return { rows: [{ id: 0 }], rowCount: count };
    }
    if (s.startsWith("insert into password_reset_tokens")) {
      const user_id = String(values[0]);
      const token_hash = String(values[1]);
      const created = new Date();
      const expiresAt = new Date(created.getTime() + RESET_TTL_SECONDS * 1000);
      const id = String(this.resetTokens.size + 1);
      const row: StrMap = { id, user_id, token_hash, expires_at: expiresAt, used_at: null, created_at: created };
      this.resetTokens.set(`${user_id}|${token_hash}`, row);
      return { rows: [{ id, expires_at: expiresAt }], rowCount: 1 };
    }
    if (s.startsWith("insert into audit_logs")) {
      const action = String(values[0]);
      let stored: Record<string, unknown> = {};
      const raw = values[4];
      if (typeof raw === "string") {
        try {
          const outer = JSON.parse(raw) as Record<string, unknown>;
          const inner = (outer["metadata"] && typeof outer["metadata"] === "object")
            ? outer["metadata"] as Record<string, unknown> : {};
          stored = { ...outer, metadata: inner };
        } catch { stored = {}; }
      }
      this.auditLog.push({ action, metadata: stored });
      return { rows: [{ id: String(this.auditLog.length) }], rowCount: 1 };
    }
    if (s === "begin" || s === "commit" || s === "rollback") return { rows: [], rowCount: 0 };
    if (s.startsWith("update users set password_hash")) {
      const id = String(values[0]);
      const u = this.users.get(id);
      if (!u) return { rows: [], rowCount: 0 };
      u["password_hash"] = String(values[1]);
      u["updated_at"] = new Date();
      return { rows: [{ id }], rowCount: 1 };
    }
    if (s.startsWith("select prt.id, prt.user_id, prt.expires_at, prt.used_at, u.status as user_status")) {
      const u = String(values[0]);
      const h = String(values[1]);
      const row = this.resetTokens.get(`${u}|${h}`);
      if (!row) return { rows: [], rowCount: 0 };
      const user = this.users.get(u);
      return {
        rows: [{
          id: row["id"], user_id: row["user_id"], expires_at: row["expires_at"],
          used_at: row["used_at"], user_status: user ? String(user["status"]) : "disabled",
        }],
        rowCount: 1,
      };
    }
    throw new Error("FakeDb: unsupported query: " + s);
  }
  async end(): Promise<void> {}
  get configured(): boolean { return true; }
}

const newId = () => randomBytes(16).toString("hex");
async function makeSvc() {
  const db = new FakeDb();
  const svc = new PasswordResetService(
    db as unknown as ConstructorParameters<typeof PasswordResetService>[0],
    "https://www.ff90.online",
  );
  return { db, svc };
}
async function seedUser(
  db: FakeDb, email: string, _password?: string, status: "active" | "disabled" = "active"
) {
  const id = newId();
  db.users.set(id, {
    id, email,
    password_hash: hashPassword("strong-test-password-1"),
    display_name: "Test", role: "admin", status,
    created_at: new Date(), updated_at: new Date(),
  });
  return id;
}
function withCapturedConsole<T>(fn: () => Promise<T>): Promise<{ result: T; captured: string[] }> {
  return (async () => {
    const out: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => {
      out.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
    };
    try { return { result: await fn(), captured: out }; }
    finally { console.log = orig; }
  })();
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_DEV_FLAG = process.env.FF_EMAIL_DEV_CONSOLE_ENABLE;
const envObj = process.env as Record<string, string | undefined>;

describe("password reset normalization + hashing helpers", () => {
  after(() => { setEmailTransportForTest(null); });

  it("normalizeEmail: trim + lowercase + structural check", () => {
    assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
    assert.equal(normalizeEmail("nope"), null);
    assert.equal(normalizeEmail("a@b"), null);
    assert.equal(normalizeEmail("a@b.c"), "a@b.c");
    assert.equal(normalizeEmail(""), null);
  });
  it("hashResetToken: 64 hex chars, deterministic, distinct inputs differ", () => {
    const a = hashResetToken("plaintext");
    assert.equal(a.length, 64);
    assert.equal(a, hashResetToken("plaintext"));
    assert.notEqual(a, hashResetToken("other"));
  });
  it("generateResetToken: base64url, >= 43 chars, distinct", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    assert.ok(a.length >= 43);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
    assert.notEqual(a, b);
  });
});

describe("password reset service — request flow", () => {
  let db: FakeDb;
  let svc: PasswordResetService;

  beforeEach(async () => {
    const built = await makeSvc();
    db = built.db; svc = built.svc;
    envObj["NODE_ENV"] = "production";
    delete process.env.FF_EMAIL_DEV_CONSOLE_ENABLE;
  });
  after(() => { setEmailTransportForTest(null); });

  it("unknown email returns same public response shape; no email sent", () => {
    setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
    return svc.requestReset({
      email: "nope@unknown.example", ipHash: null, requestId: null,
    }).then((a) => {
      assert.equal(a.ok, true);
    });
  });

  it("known email returns same public response shape; email transport is called once", () => {
    let captured = 0;
    setEmailTransportForTest(() => { captured++; return { ok: false, reason: "provider_not_configured" }; });
    return seedUser(db, "alice@example.com", "correct-horse-battery-staple").then(() => {
      return svc.requestReset({
        email: "alice@example.com", ipHash: "iphash-prefix", requestId: "req-1",
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
    await seedUser(db, "real@example.com", "strong-password-1");
    const a = await svc.requestReset({ email: "real@example.com", ipHash: null, requestId: null });
    const b = await svc.requestReset({ email: "ghost@example.com", ipHash: null, requestId: null });
    assert.equal(a.ok, b.ok);
    assert.equal(a.ok, true);
  });

  it("disabled accounts: generic verdict, audit row written", () => {
    setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
    return seedUser(db, "disabled@example.com", "x-strong-pw-12+chars", "disabled").then(() => {
      return svc.requestReset({
        email: "disabled@example.com", ipHash: null, requestId: null,
      });
    }).then((r) => {
      assert.equal(r.ok, true);
      assert.equal(r.deliveryStatus, "skipped_user_disabled");
    });
  });

  it("stores token as sha-256 hash, never plaintext", async () => {
      setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
      await seedUser(db, "alice2@example.com", "strong-password-1");
      await svc.requestReset({ email: "alice2@example.com", ipHash: null, requestId: null });
    });

  it("invalidating prior tokens for same user + burning freshly-issued tokens on delivery failure", () => {
    setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
    return seedUser(db, "frank@example.com", "old-strong-frank-pw").then((id) => {
      return svc.requestReset({ email: "frank@example.com", ipHash: null, requestId: null })
        .then(() => {
          const initial = Array.from(db.resetTokens.values()).filter((r) => r["user_id"] === id);
          assert.equal(initial.length, 1);
          assert.ok(initial[0]["used_at"] !== null,
            "first token must be burned (delivery_unavailable safe-failure)");
          return svc.requestReset({ email: "frank@example.com", ipHash: null, requestId: null });
        })
        .then(() => {
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
        assert.ok(!("token_hash" in m));
        assert.ok(!("password" in m));
        assert.ok(!("token_plaintext" in m));
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
    const inner = unavailable!.metadata["metadata"] as Record<string, unknown>;
    assert.equal(inner["email_provider_state"], "EMAIL_PROVIDER_NOT_CONFIGURED");
  });
});

describe("password reset service — complete flow", () => {
  let db: FakeDb;
  let svc: PasswordResetService;

  beforeEach(async () => {
    const built = await makeSvc();
    db = built.db; svc = built.svc;
    setEmailTransportForTest(() => ({ ok: false, reason: "provider_not_configured" }));
  });
  after(() => { setEmailTransportForTest(null); });

  it("invalid token returns generic verdict; audit row written", () => {
    return seedUser(db, "bob@example.com", "strong-password-1").then((id) => {
      return svc.completeReset({
        userId: id, plaintextToken: "completely-bogus-token",
        newPasswordHash: hashPassword("new-strong-pass-1"),
        ipHash: null, requestId: null,
      });
    }).then((r) => {
      assert.equal(r.ok, false);
    });
  });

  it("successful reset: verifyPassword(new) true; old password fails", () => {
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
        userId: id, plaintextToken: plaintext,
        newPasswordHash: hashPassword("fresh-strong-pass-2"),
        ipHash: null, requestId: null,
      }).then((r) => {
        assert.deepEqual(r, { ok: true });
        const storedNew = String(db.users.get(id)!["password_hash"]);
        assert.notEqual(storedNew, storedOld);
        assert.equal(verifyPassword("old-carol-strong-pw-original", storedNew), false);
        assert.equal(verifyPassword("fresh-strong-pass-2", storedNew), true);
      });
    });
  });

  it("token single-use: second reset with same plaintext fails", () => {
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
        newPasswordHash: hashPassword("new-strong-expired-pw"),
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
  beforeEach(async () => { db = (await makeSvc()).db; });
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

// ---------------------------------------------------------------------------
// Resend transport tests (mocked fetch, no network).
// ---------------------------------------------------------------------------

describe("Resend transport (mocked fetch, no network)", () => {
  type CapturedReq = { url: string; headers: Record<string, string>; body: any };
  let captured: CapturedReq[] = [];
  const envObj = process.env as Record<string, string | undefined>;

  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_RESEND = process.env.RESEND_API_KEY;
  const ORIGINAL_FROM = process.env.RESET_EMAIL_FROM;
  const ORIGINAL_REPLY = process.env.RESET_EMAIL_REPLY_TO;
  const ORIGINAL_DEV_OPT = process.env.FF_EMAIL_DEV_CONSOLE_ENABLE;

  function patchFetchOnce(fn: any): void {
    const orig = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = fn;
    after(() => { (globalThis as { fetch?: unknown }).fetch = orig; });
  }
  function resetEnv(): void {
    if (ORIGINAL_NODE_ENV === undefined) delete envObj["NODE_ENV"];
    else envObj["NODE_ENV"] = ORIGINAL_NODE_ENV;
    if (ORIGINAL_RESEND === undefined) delete envObj["RESEND_API_KEY"];
    else envObj["RESEND_API_KEY"] = ORIGINAL_RESEND;
    if (ORIGINAL_FROM === undefined) delete envObj["RESET_EMAIL_FROM"];
    else envObj["RESET_EMAIL_FROM"] = ORIGINAL_FROM;
    if (ORIGINAL_REPLY === undefined) delete envObj["RESET_EMAIL_REPLY_TO"];
    else envObj["RESET_EMAIL_REPLY_TO"] = ORIGINAL_REPLY;
    if (ORIGINAL_DEV_OPT === undefined) delete envObj["FF_EMAIL_DEV_CONSOLE_ENABLE"];
    else envObj["FF_EMAIL_DEV_CONSOLE_ENABLE"] = ORIGINAL_DEV_OPT;
    setEmailTransportForTest(null);
  }

  beforeEach(() => {
    captured = [];
    envObj["NODE_ENV"] = "production";
    delete envObj["RESEND_API_KEY"];
    delete envObj["RESET_EMAIL_FROM"];
    delete envObj["RESET_EMAIL_REPLY_TO"];
    delete envObj["FF_EMAIL_DEV_CONSOLE_ENABLE"];
  });
  after(resetEnv);

  it("production: provider-not-configured path returns provider_not_configured silently", async () => {
    patchFetchOnce(async (url: string, init?: any) => {
      captured.push({ url, headers: init?.headers ?? {}, body: init?.body });
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    });
    const r = await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=SECRET",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "provider_not_configured");
    assert.equal(captured.length, 0);
  });

  it("production: Resend transport posts to api.resend.com with correct from/to/subject/url", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    patchFetchOnce(async (url: string, init?: any) => {
      const bodyParsed = JSON.parse(init.body);
      captured.push({
        url,
        headers: Object.fromEntries(
          Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)])
        ),
        body: bodyParsed,
      });
      return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
    });
    const r = await sendResetEmail({
      to: "user@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=PLAINTEXT_TOKEN",
      expiresAtIso: new Date(Date.now() + 1800_000).toISOString(),
      userId: "u1", tokenId: 42,
    });
    assert.equal(r.ok, true);
    assert.equal(captured.length, 1);
    const req = captured[0];
    assert.equal(req.url, "https://api.resend.com/emails");
    assert.match(req.headers["authorization"] ?? "", /^Bearer /);
    assert.equal(typeof req.headers["content-type"], "string");
    assert.equal(req.body.from, "FF90 <no-reply@ff90.online>");
    assert.deepEqual(req.body.to, ["user@example.com"]);
    assert.equal(req.body.subject, "ตั้งรหัสผ่านใหม่สำหรับ FF90.online");
    assert.equal(req.body.text.includes("https://www.ff90.online/admin/reset-password?token=PLAINTEXT_TOKEN"), true);
    assert.equal(req.body.html.includes("https://www.ff90.online/admin/reset-password?token=PLAINTEXT_TOKEN"), true);
    const bodyStr = JSON.stringify(req.body);
    assert.equal(bodyStr.includes("test-key-fake"), false, "API key leaked into request body");
    const headerStr = JSON.stringify(req.headers);
    assert.equal(headerStr.includes("PLAINTEXT_TOKEN"), false, "token leaked into request headers");
  });

  it("production: reply_to omitted when RESET_EMAIL_REPLY_TO is unset", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    patchFetchOnce(async (url: string, init?: any) => {
      captured.push({ url, headers: {}, body: JSON.parse(init.body) });
      return new Response("{}", { status: 200 });
    });
    await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.equal("reply_to" in captured[0].body, false);
  });

  it("production: reply_to is forwarded when RESET_EMAIL_REPLY_TO is set", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    envObj["RESET_EMAIL_REPLY_TO"] = "support@ff90.online";
    patchFetchOnce(async (url: string, init?: any) => {
      captured.push({ url, headers: {}, body: JSON.parse(init.body) });
      return new Response("{}", { status: 200 });
    });
    await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.deepEqual(captured[0].body.reply_to, ["support@ff90.online"]);
  });

  it("production: 4xx from Resend is mapped to delivery_failed (no throw)", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    patchFetchOnce(async () => new Response("error-page-html", { status: 422 }));
    const r = await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "delivery_failed");
  });

  it("production: 5xx from Resend is mapped to delivery_failed", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    patchFetchOnce(async () => new Response("", { status: 500 }));
    const r = await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.equal(r.ok, false);
  });

  it("production: fetch throw (network) becomes delivery_failed", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    patchFetchOnce(async () => { throw new Error("ECONNRESET"); });
    const r = await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "delivery_failed");
  });

  it("email text body: FF90.online branding, 30-minute expiry, contact@ff90.online, ignore-if-not-you", () => {
    const text = renderResetEmailText({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.match(text, /FF90\.online/);
    assert.match(text, /30 นาที/);
    assert.match(text, /contact@ff90\.online/);
    assert.match(text, /ไม่ได้เป็นผู้ร้องขอ/);
    assert.equal(/role/i.test(text), false);
    assert.equal(/user_id/i.test(text), false);
  });

  it("email html body: same invariants + safe URL escaping", () => {
      const html = renderResetEmailHtml({
        to: "u@example.com",
        resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
        expiresAtIso: new Date().toISOString(),
        userId: "u", tokenId: 1,
      });
      assert.match(html, /FF90\.online/);
      assert.match(html, /30 นาที/);
      assert.match(html, /contact@ff90\.online/);
      // The reset URL appears exactly once inside the anchor as href=…
      // The URL itself contains no quote characters, so the rendered
      // attribute is the literal href="https://…". If the URL ever
      // contains characters that need escaping (e.g. & or "), the
      // escapeHtmlAttr helper at runtime escapes them to &amp; / &quot;.
      assert.match(
        html,
        /<a href="https:\/\/www\.ff90\.online\/admin\/reset-password\?token=T"/,
      );
    });

  it("production: dev-console opt-in env does NOT enable dev-console when Resend env is set", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    envObj["FF_EMAIL_DEV_CONSOLE_ENABLE"] = "1";
    patchFetchOnce(async (url: string, init?: any) => {
      captured.push({ url, headers: {}, body: JSON.parse(init.body) });
      return new Response("{}", { status: 200 });
    });
    await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, "https://api.resend.com/emails");
  });

  it("production: missing-from returns provider_not_configured silently", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    patchFetchOnce(async (url: string, init?: any) => {
      captured.push({ url, headers: {}, body: init?.body });
      return new Response("{}", { status: 200 });
    });
    const r = await sendResetEmail({
      to: "u@example.com",
      resetUrl: "https://www.ff90.online/admin/reset-password?token=T",
      expiresAtIso: new Date().toISOString(),
      userId: "u", tokenId: 1,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "provider_not_configured");
    assert.equal(captured.length, 0);
  });

  it("providerKind: resend when env is set; silent_unconfigured otherwise; dev_console in dev", () => {
    envObj["NODE_ENV"] = "production";
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    assert.equal(providerKind(), "resend");
    delete envObj["RESEND_API_KEY"];
    assert.equal(providerKind(), "silent_unconfigured");
    envObj["NODE_ENV"] = "development";
    envObj["FF_EMAIL_DEV_CONSOLE_ENABLE"] = "1";
    assert.equal(providerKind(), "dev_console");
  });

  it("service-level: successful delivery does NOT burn the freshly-issued token", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    patchFetchOnce(async () => new Response("{}", { status: 200 }));
    const built = await makeSvc();
    await seedUser(built.db, "realprod@example.com");
    const r = await built.svc.requestReset({
      email: "realprod@example.com", ipHash: null, requestId: null,
    });
    assert.equal(r.ok, true);
    const tokens = Array.from(built.db.resetTokens.values());
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0]["used_at"], null);
  });

  it("service-level: failed delivery burns the freshly-issued token", async () => {
    envObj["RESEND_API_KEY"] = "test-key-fake";
    envObj["RESET_EMAIL_FROM"] = "no-reply@ff90.online";
    patchFetchOnce(async () => new Response("{}", { status: 422 }));
    const built = await makeSvc();
    await seedUser(built.db, "realburn@example.com");
    await built.svc.requestReset({
      email: "realburn@example.com", ipHash: null, requestId: null,
    });
    const tokens = Array.from(built.db.resetTokens.values());
    assert.equal(tokens.length, 1);
    assert.notEqual(tokens[0]["used_at"], null);
  });
});
