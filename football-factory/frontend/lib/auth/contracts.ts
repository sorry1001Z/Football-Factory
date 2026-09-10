// Football Factory — auth contracts (FIRST SLICE).
//
// Pure type module. No runtime imports. Imported by all auth modules.

export type Role = "admin" | "editor" | "author" | "member";

export const ALL_ROLES: readonly Role[] = [
  "admin",
  "editor",
  "author",
  "member",
] as const;

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ALL_ROLES as readonly string[]).includes(v);
}

export type UserStatus = "active" | "disabled";

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: UserStatus;
};

export type UserWithPassword = User & { password_hash: string };

export type Session = {
  userId: string;
  role: Role;
  email: string;
  exp: number; // unix seconds
  iat: number; // unix seconds
};

export type JwtHeader = { alg: "HS256"; typ: "JWT" };
