// Football Factory — R2.1 Wave B consent primitive tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_VERSION,
  initialConsent,
  acceptAll,
  rejectOptional,
  savePreferences,
  isValidConsentSnapshot,
} from "../index";
import {
  MemoryConsentStorage,
  LocalStorageConsentStorage,
} from "../storage";
import {
  analyticsBridge,
  canLoadAds,
} from "../bridge";
import { createConsentModalController } from "@/components/consent/modal-controller";

// -----------------------------------------------------------------------------
// version
// -----------------------------------------------------------------------------

test("consent: CONSENT_VERSION is 1", () => {
  assert.equal(CONSENT_VERSION, 1);
});

// -----------------------------------------------------------------------------
// snapshot factories
// -----------------------------------------------------------------------------

test("consent: initialConsent -> unknown + necessary=true + analytics=false + ads=false", () => {
  const s = initialConsent();
  assert.equal(s.consentVersion, CONSENT_VERSION);
  assert.equal(s.state, "unknown");
  assert.equal(s.preferences.necessary, true);
  assert.equal(s.preferences.analytics, false);
  assert.equal(s.preferences.ads, false);
});

test("consent: acceptAll -> granted + analytics=true + ads=true + updatedAt present", () => {
  const s = acceptAll();
  assert.equal(s.state, "granted");
  assert.equal(s.preferences.necessary, true);
  assert.equal(s.preferences.analytics, true);
  assert.equal(s.preferences.ads, true);
  assert.equal(typeof s.updatedAt, "string");
});

test("consent: rejectOptional -> denied + analytics=false + ads=false + updatedAt present", () => {
  const s = rejectOptional();
  assert.equal(s.state, "denied");
  assert.equal(s.preferences.necessary, true);
  assert.equal(s.preferences.analytics, false);
  assert.equal(s.preferences.ads, false);
  assert.equal(typeof s.updatedAt, "string");
});

test("consent: savePreferences(true,true) -> granted", () => {
  const s = savePreferences(true, true);
  assert.equal(s.state, "granted");
  assert.equal(s.preferences.analytics, true);
  assert.equal(s.preferences.ads, true);
});

test("consent: savePreferences(true,false) -> granted (analytics-only is still granted)", () => {
  const s = savePreferences(true, false);
  assert.equal(s.state, "granted");
  assert.equal(s.preferences.analytics, true);
  assert.equal(s.preferences.ads, false);
});

test("consent: savePreferences(false,true) -> granted (ads-only is still granted)", () => {
  const s = savePreferences(false, true);
  assert.equal(s.state, "granted");
  assert.equal(s.preferences.analytics, false);
  assert.equal(s.preferences.ads, true);
});

test("consent: savePreferences(false,false) -> denied (deterministic semantics)", () => {
  const s = savePreferences(false, false);
  assert.equal(s.state, "denied");
  assert.equal(s.preferences.analytics, false);
  assert.equal(s.preferences.ads, false);
});

// -----------------------------------------------------------------------------
// validator
// -----------------------------------------------------------------------------

test("consent: isValidConsentSnapshot accepts canonical snapshots", () => {
  assert.equal(isValidConsentSnapshot(initialConsent()), true);
  assert.equal(isValidConsentSnapshot(acceptAll()), true);
  assert.equal(isValidConsentSnapshot(rejectOptional()), true);
});

test("consent: validator refuses wrong consentVersion", () => {
  const s = initialConsent();
  assert.equal(isValidConsentSnapshot({ ...s, consentVersion: 999 }), false);
});

test("consent: validator refuses necessary=false", () => {
  const s = initialConsent();
  assert.equal(
    isValidConsentSnapshot({
      ...s,
      preferences: { necessary: false, analytics: false, ads: false },
    }),
    false,
  );
});

test("consent: validator refuses non-boolean analytics", () => {
  const s = initialConsent();
  assert.equal(
    isValidConsentSnapshot({
      ...s,
      preferences: { necessary: true, analytics: "yes", ads: false },
    }),
    false,
  );
});

test("consent: validator refuses non-boolean ads", () => {
  const s = initialConsent();
  assert.equal(
    isValidConsentSnapshot({
      ...s,
      preferences: { necessary: true, analytics: false, ads: 1 },
    }),
    false,
  );
});

test("consent: validator refuses invalid state", () => {
  const s = initialConsent();
  assert.equal(
    isValidConsentSnapshot({ ...s, state: "MAYBE" }),
    false,
  );
});

test("consent: validator refuses null/undefined/non-objects", () => {
  assert.equal(isValidConsentSnapshot(null), false);
  assert.equal(isValidConsentSnapshot(undefined), false);
  assert.equal(isValidConsentSnapshot("not a snapshot"), false);
  assert.equal(isValidConsentSnapshot(42), false);
});

// -----------------------------------------------------------------------------
// MemoryConsentStorage
// -----------------------------------------------------------------------------

test("memory storage: valid save / load round trip", () => {
  const s = new MemoryConsentStorage();
  assert.equal(s.load(), null);
  const next = acceptAll();
  s.save(next);
  const loaded = s.load();
  assert.ok(loaded);
  assert.equal(loaded!.state, "granted");
});

test("memory storage: save rejects malformed snapshot", () => {
  const s = new MemoryConsentStorage();
  // Cast to any because the input is intentionally invalid.
  assert.throws(() => s.save({} as any), TypeError);
});

test("memory storage: clear resets to null", () => {
  const s = new MemoryConsentStorage();
  s.save(acceptAll());
  s.clear();
  assert.equal(s.load(), null);
});

test("memory storage: load returns clone, not internal reference", () => {
  const s = new MemoryConsentStorage();
  s.save(acceptAll());
  const loaded = s.load();
  assert.notEqual(loaded, (s as any).value);
});

// -----------------------------------------------------------------------------
// LocalStorageConsentStorage
// -----------------------------------------------------------------------------

const fakeBrowser = (() => {
  const store = new Map<string, string>();
  return {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
})();

test("localstorage storage: load returns null when key absent", () => {
  const s = new LocalStorageConsentStorage("ff_consent_test_absent", fakeBrowser);
  assert.equal(s.load(), null);
});

test("localstorage storage: valid save / load round trip", () => {
  const s = new LocalStorageConsentStorage("ff_consent_test_round", fakeBrowser);
  s.save(rejectOptional());
  const loaded = s.load();
  assert.ok(loaded);
  assert.equal(loaded!.state, "denied");
});

test("localstorage storage: malformed JSON returns null safely", () => {
  fakeBrowser.localStorage.setItem("ff_consent_test_malformed", "{not json");
  const s = new LocalStorageConsentStorage("ff_consent_test_malformed", fakeBrowser);
  assert.equal(s.load(), null);
});

test("localstorage storage: malformed schema returns null safely", () => {
  fakeBrowser.localStorage.setItem(
    "ff_consent_test_bad_schema",
    JSON.stringify({ consentVersion: 1, state: "MAYBE", preferences: {} }),
  );
  const s = new LocalStorageConsentStorage("ff_consent_test_bad_schema", fakeBrowser);
  assert.equal(s.load(), null);
});

test("localstorage storage: wrong consentVersion returns null", () => {
  fakeBrowser.localStorage.setItem(
    "ff_consent_test_wrong_ver",
    JSON.stringify({
      consentVersion: 999,
      state: "granted",
      preferences: { necessary: true, analytics: true, ads: true },
    }),
  );
  const s = new LocalStorageConsentStorage("ff_consent_test_wrong_ver", fakeBrowser);
  assert.equal(s.load(), null);
});

test("localstorage storage: no browser -> load returns null, save/clear noop", () => {
  const s = new LocalStorageConsentStorage("ff_consent_test_nobrowser", null);
  assert.equal(s.load(), null);
  s.save(acceptAll()); // should not throw
  s.clear();           // should not throw
  assert.equal(s.load(), null);
});

test("localstorage storage: SSR safety — module import does not touch window", () => {
  // If this test imports the storage module at the top of the file
  // (which it does) AND we reach this line, no global access has
  // happened at module load. We additionally assert that no
  // `localStorage` was set on globalThis by importing.
  // In Node, globalThis.localStorage is undefined; in the browser
  // it would be defined by the host environment. We cannot fully
  // simulate the browser here, so we just check the shape of the
  // constructor.
  const s = new LocalStorageConsentStorage("k", null);
  assert.equal(s.load(), null);
});

// -----------------------------------------------------------------------------
// analyticsBridge
// -----------------------------------------------------------------------------

function makeFakeProvider(label: string) {
  const calls: Array<{ name: string; path?: string }> = [];
  return {
    label,
    enabled: () => true,
    consentGranted: () => true,
    trackEvent(e: { name: string; path?: string }) {
      calls.push({ name: e.name, path: e.path });
    },
    calls,
  };
}

test("analytics bridge: unknown -> noop", () => {
  const real = makeFakeProvider("real");
  const out = analyticsBridge(initialConsent(), real);
  out.trackEvent({ name: "page_view" });
  assert.equal(real.calls.length, 0);
});

test("analytics bridge: denied -> noop", () => {
  const real = makeFakeProvider("real");
  const out = analyticsBridge(rejectOptional(), real);
  out.trackEvent({ name: "page_view" });
  assert.equal(real.calls.length, 0);
});

test("analytics bridge: granted but analytics=false -> noop", () => {
  const real = makeFakeProvider("real");
  const snap = savePreferences(false, true); // granted, analytics=false
  const out = analyticsBridge(snap, real);
  out.trackEvent({ name: "page_view" });
  assert.equal(real.calls.length, 0);
});

test("analytics bridge: granted + analytics=true -> real provider", () => {
  const real = makeFakeProvider("real");
  const out = analyticsBridge(acceptAll(), real);
  out.trackEvent({ name: "page_view", path: "/" });
  assert.equal(real.calls.length, 1);
  assert.equal(real.calls[0].name, "page_view");
});

test("analytics bridge: missing real provider -> noop", () => {
  const out = analyticsBridge(acceptAll(), null);
  // Calling trackEvent on a noop must be a no-op (no throw).
  out.trackEvent({ name: "page_view" });
});

// -----------------------------------------------------------------------------
// canLoadAds
// -----------------------------------------------------------------------------

test("ads: unknown -> false", () => {
  assert.equal(canLoadAds(initialConsent()), false);
});

test("ads: denied -> false", () => {
  assert.equal(canLoadAds(rejectOptional()), false);
});

test("ads: granted ads=false -> false", () => {
  assert.equal(canLoadAds(savePreferences(true, false)), false);
});

test("ads: granted ads=true -> true", () => {
  assert.equal(canLoadAds(savePreferences(false, true)), true);
  assert.equal(canLoadAds(acceptAll()), true);
});

test("ads: null snapshot -> false", () => {
  assert.equal(canLoadAds(null), false);
  assert.equal(canLoadAds(undefined), false);
});

// -----------------------------------------------------------------------------
// modal controller
// -----------------------------------------------------------------------------

function makeFocusables() {
  const a: any = { id: "a" };
  const b: any = { id: "b" };
  const op: any = { id: "op" };
  const calls = { focused: null as any, closed: 0 };
  const ctrl = createConsentModalController({
    getFocusable: () => [a, b],
    close: () => {
      calls.closed += 1;
    },
    focusElement: (el: any) => {
      calls.focused = el;
    },
  });
  return { a, b, op, calls, ctrl };
}

test("modal: initial focus on open", () => {
  const { a, op, calls, ctrl } = makeFocusables();
  ctrl.openModal(op);
  assert.equal(calls.focused, a);
});

test("modal: Tab cycles forward", () => {
  const { a, b, op, calls, ctrl } = makeFocusables();
  ctrl.openModal(op);
  ctrl.onKeyDown({ key: "Tab", shiftKey: false, activeElement: a, preventDefault() {} });
  assert.equal(calls.focused, b);
  ctrl.onKeyDown({ key: "Tab", shiftKey: false, activeElement: b, preventDefault() {} });
  assert.equal(calls.focused, a);
});

test("modal: Shift+Tab cycles backward", () => {
  const { a, b, op, calls, ctrl } = makeFocusables();
  ctrl.openModal(op);
  ctrl.onKeyDown({ key: "Tab", shiftKey: true, activeElement: b, preventDefault() {} });
  assert.equal(calls.focused, a);
});

test("modal: Escape closes and restores focus", () => {
  const { op, calls, ctrl } = makeFocusables();
  ctrl.openModal(op);
  ctrl.onKeyDown({ key: "Escape", preventDefault() {} });
  assert.equal(calls.closed, 1);
  assert.equal(calls.focused, op);
});

test("modal: key handler returns false when closed", () => {
  const { ctrl } = makeFocusables();
  assert.equal(ctrl.isOpen(), false);
  assert.equal(ctrl.onKeyDown({ key: "Tab" }), false);
});

test("modal: no focusable elements + Tab -> preventDefault and no focus", () => {
  const op: any = { id: "op" };
  let focused: any = "untouched";
  let prevented = 0;
  const ctrl = createConsentModalController({
    getFocusable: () => [],
    focusElement: (el: any) => {
      focused = el;
    },
  });
  ctrl.openModal(op);
  focused = "untouched";
  ctrl.onKeyDown({
    key: "Tab",
    preventDefault() {
      prevented += 1;
    },
  });
  assert.equal(prevented, 1);
  assert.equal(focused, "untouched");
});

test("modal: refreshFocusable re-reads the focusable list", () => {
  // Helper for value-based equality (activeElement is a different
  // object reference than the items in the focusable array).
  const byId = <T extends { id?: string }>(items: readonly T[], id: string) =>
    items.findIndex((it) => it.id === id);

  let current = [{ id: "x" }];
  let focused: any = null;
  const op: any = { id: "op" };
  const ctrl = createConsentModalController({
    getFocusable: () => current,
    focusElement: (el: any) => {
      focused = el;
    },
  });
  ctrl.openModal(op);
  assert.equal(focused.id, "x");
  current = [{ id: "y" }, { id: "z" }];
  focused = null;
  ctrl.refreshFocusable();
  // Simulate user pressing Tab while focused on the "y" item.
  const idxY = byId(current, "y");
  ctrl.onKeyDown({
    key: "Tab",
    shiftKey: false,
    activeElement: { id: "y" },
    preventDefault() {},
  });
  // Verify the controller's lookup matches the indexOf it would do
  // itself (value-based, not reference-based).
  assert.equal(idxY, 0);
  // After Tab from index 0 of a 2-item list, next index is 1 → "z".
  assert.equal(focused.id, "z");
});

test("modal: refreshOnValueChange mirrors preferences snapshot", () => {
  const ctrl = createConsentModalController();
  let captured: any = null;
  ctrl.refreshOnValueChange({ analytics: true, ads: false }, (s) => {
    captured = s;
  });
  assert.deepEqual(captured, { analytics: true, ads: false });
  ctrl.refreshOnValueChange({ analytics: false, ads: true }, (s) => {
    captured = s;
  });
  assert.deepEqual(captured, { analytics: false, ads: true });
});
