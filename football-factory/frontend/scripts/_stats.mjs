// Football Factory — shared statistics utility for benchmark and smoke tools.
//
// Ported from the external Performance / Observability R2 pack (src/stats.mjs)
// and adapted to the live repo's scripts directory.
//
// Pure functions only. No I/O, no env reads, no console output.
// Callers (scripts/benchmark.mjs, scripts/benchmark-compare.mjs, smoke tools)
// use this module for percentile + summary math.
//
// EXPORTS:
//   percentile(xs, p)
//   summarize(xs)
//
// Both functions are deterministic. Empty arrays return 0 for percentiles
// and Infinity/-Infinity for min/max (caller should guard).

/**
 * Return the p-th percentile (p in [0,1]) of xs.
 *
 * Matches the upstream R2 semantics:
 *   - empty input -> 0
 *   - sort ascending
 *   - index = min(len-1, ceil(p*len) - 1)
 */
export function percentile(xs, p) {
  if (!xs || xs.length === 0) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
}

/**
 * Compute { count, p50, p95, min, max } over xs.
 * Empty array returns count=0, min=+Infinity, max=-Infinity, percentiles 0.
 */
export const summarize = (xs) => ({
  count: xs ? xs.length : 0,
  p50: percentile(xs, 0.5),
  p95: percentile(xs, 0.95),
  min: xs && xs.length ? Math.min(...xs) : Number.POSITIVE_INFINITY,
  max: xs && xs.length ? Math.max(...xs) : Number.NEGATIVE_INFINITY,
});
