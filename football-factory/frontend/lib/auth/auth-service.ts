// Football Factory — AuthService (FIRST SLICE).
//
// Server-only. Thin orchestration over UserRepository + password + session.
// No HTTP concerns here (those live in app/api/auth/*).

import "server-only";
import type { Db } from "@/lib/db/postgres";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, verifySessionToken } from "./session";
import { UserRepository } from "./repositories";
import type { Role, Session, User } from "./contracts";

export class AuthError extends Error {
  public readonly code:
    | "email_exists"
    | "invalid_credentials"
    | "user_disabled"
    | "secret_too_short";
  constructor(
    code:
      | "email_exists"
      | "invalid_credentials"
      | "user_disabled"
      | "secret_too_short",
    msg: string,
  ) {
    super(msg);
    this.name = "AuthError";
    this.code = code;
  }
}

export type LoginResult = { user: User; token: string };

export class AuthService {
  private users: UserRepository;
  private secret: string;
  private ttlSeconds: number;

  constructor(db: Db, secret: string, ttlSeconds?: number) {
    if (
      typeof secret !== "string" ||
      secret.length < 32 ||
      /(CHANGE_ME|example\.com|replace-with)/i.test(secret)
    ) {
      throw new AuthError(
        "secret_too_short",
        "AUTH_SECRET must be >= 32 chars and not a placeholder",
      );
    }
    this.users = new UserRepository(db);
    this.secret = secret;
    this.ttlSeconds = Math.max(
      60,
      Math.floor(ttlSeconds ?? Number(process.env.SESSION_TTL_SECONDS ?? 604800)),
    );
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      // Generic error: do not reveal whether the email already exists.
      throw new AuthError("email_exists", "registration_failed");
    }
    const passwordHash = hashPassword(input.password);
    return this.users.create({ email, passwordHash, displayName, role: "member" });
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    if (
      !u ||
      u.status !== "active" ||
      !verifyPassword(password, u.password_hash)
    ) {
      // Single generic message; never reveal whether the email exists.
      throw new AuthError("invalid_credentials", "authentication_failed");
    }
    const token = createSessionToken(
      { userId: u.id, role: u.role, email: u.email },
      this.secret,
      this.ttlSeconds,
    );
    return {
      user: {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        role: u.role,
        status: u.status,
      },
      token,
    };
  }

  verify(token: string): Session | null {
    const r = verifySessionToken(token, this.secret);
    return r.ok ? r.session : null;
  }

  static roleAllowed(role: Role, allowed: readonly Role[]): boolean {
    return allowed.includes(role);
  }
}
