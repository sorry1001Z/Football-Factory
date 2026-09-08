// Football Factory — Revalidation bridge (Phase 2)
// Hardens /api/revalidate for WordPress publish/update/delete events.
// Server-only. Same REVALIDATE_SECRET contract, plus path allowlist
// so WordPress can only revalidate a bounded set of Next.js routes.

import "server-only";

const ALLOWED_REVALIDATE_PREFIXES = [
  "/",
  "/news",
  "/match",
  "/league",
  "/team",
  "/category",
  "/sitemap.xml",
  "/robots.txt",
];

const MAX_PATHS_PER_REQUEST = 25;

export interface RevalidationResult {
  ok: boolean;
  revalidated: string[];
  rejected: string[];
  at: string;
}

export function isPathAllowed(path: string): boolean {
  if (typeof path !== "string" || !path.startsWith("/")) return false;
  if (path.includes("..") || path.includes("\0") || path.length > 200) return false;
  if (path.startsWith("//")) return false;
  for (const prefix of ALLOWED_REVALIDATE_PREFIXES) {
    if (path === prefix) return true;
    if (path.startsWith(prefix + "/")) return true;
  }
  return false;
}

export function sanitizeRevalidatePaths(raw: unknown): RevalidationResult {
  const at = new Date().toISOString();
  if (!Array.isArray(raw)) {
    return { ok: false, revalidated: [], rejected: ["(not array)"], at };
  }
  const revalidated: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    if (typeof p !== "string") {
      rejected.push("(non-string)");
      continue;
    }
    if (!isPathAllowed(p)) {
      rejected.push(p);
      continue;
    }
    if (seen.has(p)) continue;
    seen.add(p);
    if (revalidated.length < MAX_PATHS_PER_REQUEST) {
      revalidated.push(p);
    } else {
      rejected.push(p + " (exceeds max)");
    }
  }
  return { ok: true, revalidated, rejected, at };
}

export function constantTimeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
