// Helper exported for tests only. Re-implements the base64url encoder
// from lib/auth/session.ts without making session.ts depend on test
// infrastructure.

export function b64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
