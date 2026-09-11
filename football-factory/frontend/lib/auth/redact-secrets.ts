// Football Factory — secret redaction helper (FIRST SLICE / 003).
//
// Used by the automation log endpoint to scrub inbound metadata before
// persisting. Removes any key whose name matches a sensitive pattern,
// recursively.
//
// Forbidden key patterns (case-insensitive, applied at every level):
//   - secret
//   - password
//   - token
//   - authorization
//   - cookie
//   - x-*-secret   (e.g. x-automation-secret, x-ff-revalidate-secret)
//
// The function returns a NEW object; the input is not mutated.

const FORBIDDEN_RE =
  /(^|[_\-.])(secret|password|token|authorization|cookie)$|^(secret|password|token|authorization|cookie)([_\-.]|$)|x-.*-secret/i;

function isForbidden(key: string): boolean {
  return FORBIDDEN_RE.test(key);
}

export function redactSecrets<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((v) => redactSecrets(v)) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (isForbidden(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out as unknown as T;
  }
  return input;
}
