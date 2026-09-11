// Football Factory — Observability types and helpers (R2 Wave 1).
//
// Merged from the external Performance / Observability R2 pack
// (src/observability.ts) into the live repo as a single source of truth.
//
// No existing observability types in /lib before this slice, so this is a
// clean merge, NOT a parallel system. Smoke / benchmark / security-check
// scripts should adopt these types and emit the `dependency` and
// `errorClass` fields alongside `latencyMs`.
//
// Pure types + a single aggregator. No I/O, no env, no side effects.

export type ErrorClass =
  | "CONFIG"
  | "AUTH"
  | "VALIDATION"
  | "UPSTREAM"
  | "TIMEOUT"
  | "NETWORK"
  | "RATE_LIMIT"
  | "DB"
  | "WORDPRESS"
  | "AUTOMATION"
  | "UNKNOWN";

/**
 * One latency measurement for a single route probe.
 * `dependency` lets us split "frontend" vs "wordpress" vs "football data"
 * when reading the report.
 */
export interface LatencyRecord {
  ts: string;
  group: string;
  route: string;
  dependency: string;
  ms: number;
  status: number;
}

/**
 * Health snapshot for a single upstream service. Smoke scripts emit one
 * of these per probed dependency.
 */
export interface Health {
  service: string;
  ok: boolean;
  latencyMs: number;
  dependency: string;
  errorClass?: ErrorClass;
}

/**
 * Roll a list of service-level health records into a single summary.
 * - ok:      true iff every service reported ok
 * - degraded: true iff any service reported !ok
 * - services: the input list, unchanged
 */
export const aggregate = (xs: Health[]) => ({
  ok: xs.every((v) => v.ok),
  degraded: xs.some((v) => !v.ok),
  services: xs,
});

/**
 * Helper for smoke/benchmark scripts that want to classify an HTTP
 * failure into an ErrorClass. Pure; no I/O.
 */
export function classifyHttp(status: number, network = false): ErrorClass {
  if (network) return "NETWORK";
  if (status === 0) return "TIMEOUT";
  if (status === 401 || status === 403) return "AUTH";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 400 && status < 500) return "VALIDATION";
  if (status >= 500 && status < 600) return "UPSTREAM";
  return "UNKNOWN";
}
