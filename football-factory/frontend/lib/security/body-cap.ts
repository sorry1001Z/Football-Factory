// Football Factory — body size cap helper (FIRST SLICE).
//
// Default cap is 1 MB for admin and auth routes. Tightens to 64 KB
// for automation routes via the `kind` parameter.
//
// Implementation: Read the body as text and check byte length BEFORE
// parsing JSON. This avoids parsing a giant payload before rejecting.

import "server-only";

export type BodyKind = "admin" | "auth" | "automation";

const CAPS: Record<BodyKind, number> = {
  admin: 1_048_576, // 1 MiB
  auth: 65_536, // 64 KiB (login, register payloads are tiny)
  automation: 65_536, // 64 KiB
};

export type BodyReadResult =
  | { ok: true; raw: string }
  | { ok: false; reason: "too_large" | "invalid_utf8" };

export async function readCappedBody(
  request: Request,
  kind: BodyKind,
): Promise<BodyReadResult> {
  const cap = CAPS[kind];
  const reader = request.body?.getReader();
  if (!reader) {
    // No body — that's fine for GET-like requests.
    return { ok: true, raw: "" };
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let received = 0;
  let raw = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > cap) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return { ok: false, reason: "too_large" };
    }
    try {
      raw += decoder.decode(value, { stream: true });
    } catch {
      return { ok: false, reason: "invalid_utf8" };
    }
  }
  raw += decoder.decode();
  return { ok: true, raw };
}
