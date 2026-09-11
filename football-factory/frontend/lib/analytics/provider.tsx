// Football Factory — Analytics foundation (R2 Wave 2D).
//
// Server-renderable analytics provider contract + client-side
// trackers. NO external network integration is shipped in this
// slice. A GA4 adapter is scaffolded (GoogleAnalyticsAdapter) but
// only initializes when `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set
// AND consent is granted. Without the env var, every tracker is
// a strict no-op.
//
// Safe-by-default: when no provider is configured, the trackers
// emit ZERO network calls and produce ZERO console output.

// ============================================================================
// Event contract
// ============================================================================

/**
 * The canonical event names. Each event carries a small set of
 * typed optional fields. The `EntityRef`-shaped payload uses
 * canonicalId (NEVER provider-native external IDs) so analytics
 * reports are stable across provider swaps.
 */
export type EventName =
  // Engagement events
  | "page_view"
  | "article_view"
  | "team_view"
  | "competition_view"
  | "search"
  | "fixture_view"
  | "standings_view"
  | "favorite"
  | "login"
  | "register"
  | "news_click"
  | "internal_link_click"
  | "fixture_click"
  // Commercial readiness events — fired only when the eligible
  // component is mounted (never fabricated). See lib/analytics/safe-event.ts.
  | "ad_impression"
  | "ad_click"
  | "sponsor_impression"
  | "sponsor_click";

export interface AnalyticsEvent {
  name: EventName;
  path?: string;
  entityId?: string; // canonical_id only
  query?: string; // search query (already trimmed and length-capped by the caller)
  method?: string; // e.g. "POST" for click-through attribution
  placement?: string; // ad/sponsor placement ID
}

/**
 * The consent state. The contract is intentionally tiny: the
 * actual consent UI is out of scope for this slice. We expose
 * `unknown` / `granted` / `denied` so a future consent banner can
 * feed it without re-plumbing the rest of the analytics layer.
 */
export type ConsentState = "unknown" | "granted" | "denied";

/**
 * The provider contract. The live default (`NoopAnalyticsProvider`)
 * returns false from `enabled()` so the `trackEvent` helper
 * short-circuits to nothing.
 *
 * `consentGranted()` defaults to true ONLY when the host application
 * has wired a real consent provider. The default `NoopConsentProvider`
 * reports `unknown`, which the `trackEvent` helper treats as
 * "do not send".
 */
export interface AnalyticsProvider {
  enabled(): boolean;
  consentGranted(): boolean;
  trackEvent(e: AnalyticsEvent): Promise<void> | void;
}

export interface ConsentProvider {
  get(): ConsentState;
}

// ============================================================================
// No-op safe defaults
// ============================================================================

export class NoopAnalyticsProvider implements AnalyticsProvider {
  enabled(): boolean {
    return false;
  }
  consentGranted(): boolean {
    return false;
  }
  trackEvent(_e: AnalyticsEvent): void {
    // intentionally empty — no network, no console, no throw
  }
}

export class NoopConsentProvider implements ConsentProvider {
  get(): ConsentState {
    return "unknown";
  }
}

// ============================================================================
// Forbidden keys (defence in depth)
// ============================================================================

/**
 * Keys that, if present on an event payload, would leak secrets
 * or unrelated private user content. `safeEvent` strips these
 * before the event is passed to any tracker implementation.
 *
 * Add to this list when integrating with a new tracker that
 * could otherwise serialize unrelated request context.
 */
export const FORBIDDEN_EVENT_KEYS: ReadonlyArray<string> = [
  "password",
  "token",
  "auth",
  "authorization",
  "set-cookie",
  "setCookie",
  "cookie",
  "session",
  "csrf",
  "secret",
  "apiKey",
  "api_key",
  "access_token",
  "refresh_token",
];

/**
 * Returns a new event object with forbidden keys removed from the
 * narrowed payload. Pure; never throws; never mutates input.
 */
export function safeEvent(event: AnalyticsEvent): AnalyticsEvent {
  // Pick only known fields. The `name` field is preserved; all
  // optional fields are copied only if they are safe.
  const out: AnalyticsEvent = { name: event.name };
  if (event.path !== undefined) out.path = event.path;
  if (event.entityId !== undefined) out.entityId = event.entityId;
  if (event.query !== undefined) {
    // Cap query at 200 chars (defence in depth — caller should
    // also cap, but never trust the caller).
    out.query = event.query.slice(0, 200);
  }
  if (event.method !== undefined) out.method = event.method;
  if (event.placement !== undefined) out.placement = event.placement;
  // Scan for accidental leakage of nested objects. The strict
  // event contract above does not include nested fields, but a
  // future maintainer could add one — this guard rejects anything
  // beyond the typed shape.
  for (const k of Object.keys(event)) {
    if (FORBIDDEN_EVENT_KEYS.includes(k)) {
      // Strip silently — never throw, never log the value.
      // (Keys are stripped, not the event.)
      continue;
    }
  }
  return out;
}

// ============================================================================
// trackEvent helper
// ============================================================================

/**
 * Short-circuits on `!enabled()` OR `!consentGranted()`. Returns
 * the underlying promise (or undefined) so callers can await the
 * dispatch when they care.
 *
 * Critically: this function NEVER throws. The `safeEvent` step is
 * applied before any provider is invoked.
 */
export function trackEvent(
  provider: AnalyticsProvider,
  event: AnalyticsEvent,
): Promise<void> | void {
  if (!provider.enabled()) return undefined;
  if (!provider.consentGranted()) return undefined;
  const safe = safeEvent(event);
  try {
    return provider.trackEvent(safe);
  } catch {
    // analytics must never break the host page
    return undefined;
  }
}

// ============================================================================
// GA4 adapter (stub unless env is present)
// ============================================================================

/**
 * A no-network GA4 adapter. Recognizes `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
 * if set at build time, but emits no network calls until a real
 * gtag.js bootstrap is wired (out of scope for this slice). This
 * adapter exists so consumers can `setProvider(new GoogleAnalyticsAdapter())`
 * without a build-time guard.
 *
 * GA4_ADAPTER_DEFERRED: A live `gtag.js` bootstrap is intentionally
 * NOT shipped. The brief allows deferring the adapter entirely; we
 * ship a structural placeholder so the contract is consumable from
 * day one. When real GA4 wiring lands, replace the body of
 * `trackEvent` with the gtag call inside `consentGranted()` block.
 */
export class GoogleAnalyticsAdapter implements AnalyticsProvider {
  private readonly measurementId: string | null;
  constructor() {
    // Read once at construction. Server-side reads of NEXT_PUBLIC_*
    // are baked in at build time.
    this.measurementId =
      typeof process !== "undefined" && process.env
        ? (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? null)
        : null;
  }
  enabled(): boolean {
    // GA4 is enabled only when the env var is present. Without it,
    // we remain a no-op even if the application wires us up.
    return Boolean(this.measurementId);
  }
  consentGranted(): boolean {
    // Until the consent UI is wired, the analytics layer treats
    // consent as unknown. The brief explicitly says "do NOT invent
    // a misleading consent banner" — we therefore default to
    // unknown and let a future slice flip this once consent is
    // surfaced to the user.
    return false;
  }
  trackEvent(_e: AnalyticsEvent): void {
    // Deferred: no gtag.js import, no dataLayer push, no network.
    // The body of this method will be replaced once consent is
    // available.
  }
}

// ============================================================================
// Singleton accessor (client-only)
// ============================================================================

let _provider: AnalyticsProvider | null = null;
let _consent: ConsentProvider | null = null;

/**
 * Sets the analytics provider. Production wiring happens at app boot
 * via `<AnalyticsRoot />` in `app/layout.tsx`. Tests can swap the
 * provider to verify dispatch.
 */
export function setAnalyticsProvider(p: AnalyticsProvider | null): void {
  _provider = p;
}

export function setConsentProvider(p: ConsentProvider | null): void {
  _consent = p;
}

export function getAnalyticsProvider(): AnalyticsProvider {
  if (_provider) return _provider;
  return new NoopAnalyticsProvider();
}

export function getConsentProvider(): ConsentProvider {
  if (_consent) return _consent;
  return new NoopConsentProvider();
}

/**
 * Convenience: returns true if dispatching an event RIGHT NOW would
 * actually send a network call. Useful for ad-impression handlers
 * that need to know whether to render the visible impression.
 */
export function wouldDispatch(): boolean {
  const p = getAnalyticsProvider();
  return p.enabled() && p.consentGranted();
}
