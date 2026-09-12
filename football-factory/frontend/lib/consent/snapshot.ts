// Football Factory — consent snapshot types + factory helpers.
//
// A canonical consent snapshot is the only shape the analytics bridge
// and ad eligibility gate accept. Snapshots are validated against
// `isValidConsentSnapshot` before being persisted or hydrated from
// storage. Malformed inputs are REJECTED — never silently coerced.
//
// Invariants:
//   - necessary is ALWAYS true (refused otherwise)
//   - analytics and ads are ALWAYS booleans (refused otherwise)
//   - state is one of "unknown" | "granted" | "denied"
//   - consentVersion matches the current CONSENT_VERSION (refused otherwise)

import { CONSENT_VERSION } from "./version";

export type ConsentState = "unknown" | "granted" | "denied";

export interface ConsentPreferences {
  /** Always true. The validator refuses necessary=false. */
  necessary: true;
  /** True when the user has explicitly opted into analytics. */
  analytics: boolean;
  /** True when the user has explicitly opted into advertising. */
  ads: boolean;
}

export interface ConsentSnapshot {
  consentVersion: number;
  state: ConsentState;
  preferences: ConsentPreferences;
  /** ISO 8601 timestamp of the most recent user-confirmed update. */
  updatedAt?: string;
}

const STATES: readonly ConsentState[] = ["unknown", "granted", "denied"];

export function isValidConsentSnapshot(value: unknown): value is ConsentSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.consentVersion !== CONSENT_VERSION) return false;
  if (typeof v.state !== "string") return false;
  if (!STATES.includes(v.state as ConsentState)) return false;
  const p = v.preferences as Record<string, unknown> | undefined;
  if (!p || typeof p !== "object") return false;
  if (p.necessary !== true) return false;
  if (typeof p.analytics !== "boolean") return false;
  if (typeof p.ads !== "boolean") return false;
  return true;
}

/**
 * Build a fresh unknown-state snapshot. Used as the default when no
 * user preference has been recorded yet.
 */
export function initialConsent(): ConsentSnapshot {
  return {
    consentVersion: CONSENT_VERSION,
    state: "unknown",
    preferences: { necessary: true, analytics: false, ads: false },
  };
}

/**
 * Accept all categories. Sets state="granted" with both optional
 * categories enabled. Adds an `updatedAt` timestamp so consumers can
 * surface "last updated" UI later.
 */
export function acceptAll(): ConsentSnapshot {
  return {
    consentVersion: CONSENT_VERSION,
    state: "granted",
    preferences: { necessary: true, analytics: true, ads: true },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reject all optional categories. Sets state="denied" with analytics
 * and ads disabled. Adds an `updatedAt` timestamp.
 */
export function rejectOptional(): ConsentSnapshot {
  return {
    consentVersion: CONSENT_VERSION,
    state: "denied",
    preferences: { necessary: true, analytics: false, ads: false },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save an explicit pair of optional preferences.
 *
 * Deterministic state semantics: when BOTH `analytics` AND `ads` are
 * false, the snapshot state is "denied". When EITHER is true, the
 * state is "granted". This is documented and intentional — refusing
 * both optional categories means the user has actively opted out
 * of everything beyond the necessary category, which is functionally
 * equivalent to the "Reject" action.
 *
 * `necessary` is forced to true and cannot be turned off.
 */
export function savePreferences(analytics: boolean, ads: boolean): ConsentSnapshot {
  const safeAnalytics = Boolean(analytics);
  const safeAds = Boolean(ads);
  return {
    consentVersion: CONSENT_VERSION,
    state: safeAnalytics || safeAds ? "granted" : "denied",
    preferences: { necessary: true, analytics: safeAnalytics, ads: safeAds },
    updatedAt: new Date().toISOString(),
  };
}
