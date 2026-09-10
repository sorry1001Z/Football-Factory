// Football Factory — password hashing (FIRST SLICE).
//
// Uses Node built-in `crypto.scryptSync` with a 16-byte random salt and
// a 64-byte derived key. The stored format is:
//
//   scrypt$<salt-hex>$<hash-hex>
//
// We do NOT depend on any external password library (no bcrypt, no
// argon2). scrypt is provided by Node out of the box.
//
// Hardening beyond the external package:
//   - minimum 10 chars (kept from the external package)
//   - rejects empty / whitespace-only
//   - constant-time comparison via `timingSafeEqual`
//   - length check before timingSafeEqual to avoid early-return timing leak

import "server-only";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const ALG = "scrypt";
const KEY_LEN = 64;
const MIN_LENGTH = 10;

export class PasswordError extends Error {
  public readonly code: "password_too_short" | "password_malformed";
  constructor(code: "password_too_short" | "password_malformed", msg: string) {
    super(msg);
    this.name = "PasswordError";
    this.code = code;
  }
}

export function hashPassword(password: string): string {
  if (typeof password !== "string") {
    throw new PasswordError("password_too_short", "password_required");
  }
  if (password.length < MIN_LENGTH || !password.trim()) {
    throw new PasswordError("password_too_short", `password_min_${MIN_LENGTH}`);
  }
  const salt = randomBytes(16).toString("hex");
  const hash = Buffer.from(scryptSync(password, salt, KEY_LEN)).toString("hex");
  return `${ALG}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [alg, salt, expected] = parts;
  if (alg !== ALG || !salt || !expected) return false;
  let actual: Buffer;
  let exp: Buffer;
  try {
    actual = Buffer.from(scryptSync(password, salt, KEY_LEN));
    exp = Buffer.from(expected, "hex");
  } catch {
    return false;
  }
  if (actual.length !== exp.length) return false;
  return timingSafeEqual(actual, exp);
}
