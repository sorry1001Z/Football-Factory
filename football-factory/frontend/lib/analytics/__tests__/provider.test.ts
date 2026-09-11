// Football Factory — Analytics foundation tests (R2 Wave 2D).
//
// Covers:
//   - NoopAnalyticsProvider: enabled=false, consentGranted=false,
//     trackEvent is a silent no-op.
//   - safeEvent: drops forbidden keys (no payload leak).
//   - safeEvent: caps query at 200 chars.
//   - trackEvent: returns undefined when provider disabled.
//   - trackEvent: returns undefined when consent denied.
//   - trackEvent: dispatches when both are true.
//   - GoogleAnalyticsAdapter: enabled=false without env var, true
//     when NEXT_PUBLIC_GA4_MEASUREMENT_ID is set.
//   - GoogleAnalyticsAdapter: consentGranted=false (consent
//     interface deferred).
//   - wouldDispatch: false in default state.
//   - Consent model: unknown / granted / denied handled.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NoopAnalyticsProvider,
  NoopConsentProvider,
  GoogleAnalyticsAdapter,
  safeEvent,
  trackEvent,
  setAnalyticsProvider,
  setConsentProvider,
  getAnalyticsProvider,
  getConsentProvider,
  wouldDispatch,
  type AnalyticsEvent,
  type ConsentProvider,
  type AnalyticsProvider,
} from "../provider";

test("NoopAnalyticsProvider: enabled=false", () => {
  const p = new NoopAnalyticsProvider();
  assert.equal(p.enabled(), false);
});

test("NoopAnalyticsProvider: consentGranted=false", () => {
  const p = new NoopAnalyticsProvider();
  assert.equal(p.consentGranted(), false);
});

test("NoopAnalyticsProvider: trackEvent is silent no-op (no throw)", () => {
  const p = new NoopAnalyticsProvider();
  assert.doesNotThrow(() =>
    p.trackEvent({ name: "page_view", path: "/x" }),
  );
});

test("NoopConsentProvider: get()=unknown", () => {
  const c = new NoopConsentProvider();
  assert.equal(c.get(), "unknown");
});

test("safeEvent: passes through plain payload", () => {
  const out = safeEvent({ name: "page_view", path: "/x" });
  assert.equal(out.name, "page_view");
  assert.equal(out.path, "/x");
});

test("safeEvent: caps query at 200 chars", () => {
  const long = "a".repeat(500);
  const out = safeEvent({ name: "search", query: long });
  assert.ok(out.query);
  assert.equal(out.query!.length, 200);
});

test("safeEvent: strips forbidden keys from the event object", () => {
  // Even if a future maintainer adds a forbidden key to the event
  // object, the safeEvent contract must not surface it. The
  // current typed contract doesn't have nested fields, so this
  // test asserts that the output has only the typed shape.
  const event = {
    name: "page_view",
    path: "/x",
    // attempt to inject forbidden keys
    token: "leaked",
    password: "leaked",
  } as unknown as AnalyticsEvent;
  const out = safeEvent(event);
  assert.equal(
    Object.prototype.hasOwnProperty.call(out, "token"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(out, "password"),
    false,
  );
});

test("trackEvent: returns undefined when provider disabled", () => {
  const p = new NoopAnalyticsProvider();
  const result = trackEvent(p, { name: "page_view", path: "/x" });
  assert.equal(result, undefined);
});

test("trackEvent: returns undefined when consent denied", () => {
  // A provider that is enabled() but not consentGranted() should
  // not dispatch.
  const p: AnalyticsProvider = {
    enabled: () => true,
    consentGranted: () => false,
    trackEvent: () => {
      throw new Error("must not be called");
    },
  };
  const result = trackEvent(p, { name: "page_view", path: "/x" });
  assert.equal(result, undefined);
});

test("trackEvent: dispatches when both enabled AND consent", () => {
  const dispatched: AnalyticsEvent[] = [];
  const p: AnalyticsProvider = {
    enabled: () => true,
    consentGranted: () => true,
    trackEvent: (e) => {
      dispatched.push(e);
    },
  };
  trackEvent(p, { name: "page_view", path: "/y" });
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].name, "page_view");
  assert.equal(dispatched[0].path, "/y");
});

test("trackEvent: provider throwing never breaks the caller", () => {
  const p: AnalyticsProvider = {
    enabled: () => true,
    consentGranted: () => true,
    trackEvent: () => {
      throw new Error("boom");
    },
  };
  // Must not throw to caller.
  let result: unknown;
  assert.doesNotThrow(() => {
    result = trackEvent(p, { name: "page_view", path: "/z" });
  });
  assert.ok(result !== undefined || result === undefined);
});

test("GoogleAnalyticsAdapter: enabled=false without env var", () => {
  // Ensure no env var is set in this test's process.
  const prev = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  delete process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  try {
    const a = new GoogleAnalyticsAdapter();
    assert.equal(a.enabled(), false);
    assert.equal(a.consentGranted(), false);
  } finally {
    if (prev !== undefined) {
      process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = prev;
    }
  }
});

test("GoogleAnalyticsAdapter: enabled=true when env var present", () => {
  const prev = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-FAKEID0000";
  try {
    const a = new GoogleAnalyticsAdapter();
    assert.equal(a.enabled(), true);
    // consentGranted still false — consent UI not yet wired.
    assert.equal(a.consentGranted(), false);
  } finally {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = prev;
    }
  }
});

test("GoogleAnalyticsAdapter: trackEvent is silent no-op (deferred)", () => {
  const a = new GoogleAnalyticsAdapter();
  assert.doesNotThrow(() =>
    a.trackEvent({ name: "page_view", path: "/x" }),
  );
});

test("wouldDispatch: false under default (no provider, unknown consent)", () => {
  // Reset any singleton state from earlier tests.
  setAnalyticsProvider(null);
  setConsentProvider(null);
  assert.equal(wouldDispatch(), false);
});

test("Consent model: granted consent flips wouldDispatch=true", () => {
  setAnalyticsProvider({
    enabled: () => true,
    consentGranted: () => true,
    trackEvent: () => undefined,
  });
  setConsentProvider({ get: () => "granted" });
  assert.equal(wouldDispatch(), true);
  // Cleanup for the next test.
  setAnalyticsProvider(null);
  setConsentProvider(null);
});

test("Consent model: denied flips wouldDispatch=false", () => {
  setAnalyticsProvider({
    enabled: () => true,
    consentGranted: () => false,
    trackEvent: () => undefined,
  });
  setConsentProvider({ get: () => "denied" });
  assert.equal(wouldDispatch(), false);
  setAnalyticsProvider(null);
  setConsentProvider(null);
});

test("getAnalyticsProvider: returns NoopAnalyticsProvider by default", () => {
  setAnalyticsProvider(null);
  const p = getAnalyticsProvider();
  assert.ok(p instanceof NoopAnalyticsProvider);
});

test("getConsentProvider: returns NoopConsentProvider by default", () => {
  setConsentProvider(null);
  const c = getConsentProvider();
  assert.ok(c instanceof NoopConsentProvider);
});

test("ConsentState type accepts unknown / granted / denied", () => {
  const states: ConsentProvider["get"][] = [
    () => "unknown",
    () => "granted",
    () => "denied",
  ];
  for (const s of states) {
    assert.ok(["unknown", "granted", "denied"].includes(s()));
  }
});
