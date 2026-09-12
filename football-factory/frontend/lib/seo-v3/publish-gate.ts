// Football Factory — SEO V3 Publish Gate (Wave A).
//
// ADVISORY ONLY. Does NOT wire into admin approval, wp-publish, or
// the automation pipeline. Tests may invoke it directly; production
// surfaces it as a future "veto hook" that callers MUST opt into.
//
// The gate separates `blockingReasons` (HARD vetoes) from `warnings`
// (advisory). Only the caller decides whether to treat warnings as
// blockers; this module never silently escalates.

export type GateReason = string;

export interface GateInput {
  score?: number;
  blockingIssues?: readonly string[];
  warnings?: readonly string[];
}

export interface GateOptions {
  minScore?: number;
  policyVersion?: string;
  /**
   * Page-level policy callback. Receives only the gate inputs
   * (score, blockingIssues, warnings) and returns extra veto /
   * warning items. Pure; never throws.
   */
  pagePolicy?: (input: {
    score: number;
    blockingIssues: readonly string[];
    warnings: readonly string[];
  }) => { blockingReasons?: readonly string[]; warnings?: readonly string[] };
}

export interface GateResult {
  pass: boolean;
  score: number;
  blockingReasons: GateReason[];
  warnings: GateReason[];
  policyVersion: string;
}

/**
 * Produce a publish-gate decision. Pure; no I/O; never throws.
 *
 * IMPORTANT: This is advisory only in Wave A. Callers must NOT
 * wire it into production approval / wp-publish until an explicit
 * later slice approves the integration.
 */
export function publishSeoGate(
  input: GateInput = {},
  options: GateOptions = {},
): GateResult {
  const minScore = options.minScore ?? 75;
  const policyVersion = options.policyVersion ?? "1";
  const score = input.score ?? 0;
  const blockingIssues = input.blockingIssues ?? [];
  const warnings = input.warnings ?? [];

  const extra = options.pagePolicy
    ? options.pagePolicy({ score, blockingIssues, warnings })
    : { blockingReasons: [] as readonly string[], warnings: [] as readonly string[] };

  const blockingReasons = [...blockingIssues, ...(extra.blockingReasons || [])];
  const allWarnings = [...warnings, ...(extra.warnings || [])];

  return {
    pass: blockingReasons.length === 0 && score >= minScore,
    score,
    blockingReasons: [...blockingReasons],
    warnings: [...allWarnings],
    policyVersion,
  };
}
