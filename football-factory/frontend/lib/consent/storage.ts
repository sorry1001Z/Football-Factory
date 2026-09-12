// Football Factory — consent storage adapters.
//
// Two adapters ship:
//
//   - MemoryConsentStorage: in-process, deterministic, used in tests
//     and SSR contexts where localStorage is unavailable.
//   - LocalStorageConsentStorage: browser-only adapter. The
//     `window`/`localStorage` access is LAZY — it happens only inside
//     `load()` / `save()` / `clear()` calls, never at module
//     initialization. SSR imports of this module never touch a
//     browser global.
//
// Both adapters validate every payload via `isValidConsentSnapshot`
// before persisting. Malformed input is REJECTED (the in-memory
// adapter throws TypeError; the localStorage adapter silently
// discards the bad value and returns null on the next load).

import {
  isValidConsentSnapshot,
  type ConsentSnapshot,
} from "./snapshot";

export interface ConsentStorage {
  load(): ConsentSnapshot | null;
  save(snapshot: ConsentSnapshot): void;
  clear(): void;
}

function clone<T>(value: T): T {
  // structuredClone is available in modern Node and modern browsers.
  // For environments that don't expose it, fall back to a deep-clone
  // via JSON round-trip (sufficient for plain-data snapshots).
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export class MemoryConsentStorage implements ConsentStorage {
  private value: ConsentSnapshot | null = null;

  load(): ConsentSnapshot | null {
    if (!isValidConsentSnapshot(this.value)) return null;
    return clone(this.value);
  }

  save(snapshot: ConsentSnapshot): void {
    if (!isValidConsentSnapshot(snapshot)) {
      throw new TypeError("INVALID_CONSENT_SNAPSHOT");
    }
    this.value = clone(snapshot);
  }

  clear(): void {
    this.value = null;
  }
}

export interface BrowserLike {
  localStorage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  } | null;
}

export class LocalStorageConsentStorage implements ConsentStorage {
  private readonly key: string;
  private readonly browser: BrowserLike | (() => BrowserLike | null | undefined) | null;

  constructor(key = "ff_consent", browser?: BrowserLike | (() => BrowserLike | null | undefined) | null) {
    this.key = key;
    this.browser = browser ?? null;
  }

  private getBrowser(): BrowserLike | null {
    if (!this.browser) {
      // Lazy default: only check `globalThis` for window when called,
      // so SSR imports stay safe.
      const g = typeof globalThis !== "undefined" ? (globalThis as unknown as BrowserLike) : null;
      return g && g.localStorage ? g : null;
    }
    const b = typeof this.browser === "function" ? this.browser() : this.browser;
    return b ?? null;
  }

  load(): ConsentSnapshot | null {
    const b = this.getBrowser();
    if (!b || !b.localStorage) return null;
    let raw: string | null;
    try {
      raw = b.localStorage.getItem(this.key);
    } catch {
      return null;
    }
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    return isValidConsentSnapshot(parsed) ? clone(parsed) : null;
  }

  save(snapshot: ConsentSnapshot): void {
    if (!isValidConsentSnapshot(snapshot)) {
      throw new TypeError("INVALID_CONSENT_SNAPSHOT");
    }
    const b = this.getBrowser();
    if (!b || !b.localStorage) return;
    try {
      b.localStorage.setItem(this.key, JSON.stringify(snapshot));
    } catch {
      // Storage quota exceeded or access denied — silently no-op.
    }
  }

  clear(): void {
    const b = this.getBrowser();
    if (!b || !b.localStorage) return;
    try {
      b.localStorage.removeItem(this.key);
    } catch {
      // silently no-op
    }
  }
}

/**
 * Convenience: a default SSR-safe in-memory storage. Callers who
 * want localStorage should construct `LocalStorageConsentStorage`
 * explicitly with a browser reference (or rely on the lazy default).
 */
export const DEFAULT_CONSENT_STORAGE: ConsentStorage = new MemoryConsentStorage();
