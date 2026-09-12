// Football Factory — analytics consent bridge + ad eligibility gate.
//
// The analytics bridge composes the existing analytics provider
// interface (`lib/analytics/provider.tsx`) with the consent snapshot.
// Until the user has explicitly granted analytics consent, the
// bridge returns the noop-shaped provider — no analytics event may
// escape.
//
// The bridge complements the existing `enabled()` /
// `consentGranted()` checks in `lib/analytics/provider.tsx`. It
// does NOT replace them: when the bridge returns the real provider
// the existing `enabled()` / `consentGranted()` gates still apply.
//
// The ad eligibility gate is separate: ads only load when the
// consent snapshot is in state="granted" AND preferences.ads===true.
// This is eligibility LOGIC only; no ad SDK is imported or loaded
// from this module.

import type { ConsentSnapshot } from "./snapshot";
import type { AnalyticsProvider } from "@/lib/analytics/provider";

/**
 * No-op analytics provider. Returns the minimal interface shape
 * that satisfies callers: `enabled()=false`, `consentGranted()=false`,
 * `trackEvent()=void`. We deliberately don't import the production
 * `NoopAnalyticsProvider` class here to avoid a circular import.
 */
const noop: AnalyticsProvider = {
  enabled: () => false,
  consentGranted: () => false,
  trackEvent: () => {
    /* no-op */
  },
};

/**
 * Decide whether the real provider is allowed to receive events.
 * Returns the real provider ONLY when:
 *   - snapshot exists
 *   - snapshot.state === "granted"
 *   - snapshot.preferences.analytics === true
 *   - realProvider is truthy
 *
 * Otherwise returns a noop provider. The existing analytics layer's
 * `enabled()` / `consentGranted()` checks still apply on top.
 */
export function analyticsBridge(
  snapshot: ConsentSnapshot | null | undefined,
  realProvider: AnalyticsProvider | null | undefined,
): AnalyticsProvider {
  if (!snapshot) return noop;
  if (snapshot.state !== "granted") return noop;
  if (snapshot.preferences.analytics !== true) return noop;
  if (!realProvider) return noop;
  return realProvider;
}

/**
 * Decide whether the ad code is allowed to load. Returns true ONLY
 * when the user has explicitly granted both the "granted" state
 * AND the `ads` preference.
 *
 * Eligibility only — no ad SDK is referenced from this module.
 */
export function canLoadAds(snapshot: ConsentSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  if (snapshot.state !== "granted") return false;
  if (snapshot.preferences.ads !== true) return false;
  return true;
}
