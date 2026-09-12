// Football Factory — consent modal controller primitive (R2.1 Wave B).
//
// BEHAVIOR-ONLY primitive. No DOM/JSX generation. No CSS. The final
// UI is implemented separately using the commercial-shell design
// system; this primitive exposes the keyboard + focus management
// that any UI implementation can plug into.
//
// Responsibilities:
//   - Open: capture opener element; focus the first focusable item
//   - Close: restore focus to the opener
//   - Tab / Shift+Tab: cycle through the focusable list
//   - Escape: invoke close + restore focus
//   - Refresh: re-read the focusable list (e.g. when state changes)
//   - Value change: notify caller so the UI can mirror preferences

export interface FocusableElement {
  /** Minimal surface; callers pass real DOM nodes through a getter. */
  id?: string;
  /** Optional focus implementation (real DOM nodes have `.focus()`). */
  focus?: () => void;
}

/**
 * @deprecated Use `FocusableElement` — the two interfaces were
 * merged because callers pass real DOM elements which satisfy both.
 */
export type FocusTarget = FocusableElement;

export interface ConsentModalDeps {
  /** Returns the current focusable elements when the modal opens. */
  getFocusable?: () => readonly FocusableElement[];
  /** Called when the modal is dismissed (Escape or programmatic). */
  close?: () => void;
  /** Optional focus implementation (defaults to `el.focus?.()`). */
  focusElement?: (el: FocusableElement) => void;
}

export interface ConsentModalController {
  openModal(opener: FocusableElement | null): void;
  closeModal(): void;
  /** Returns true when the key was handled. */
  onKeyDown(event: { key?: string; shiftKey?: boolean; preventDefault?: () => void; activeElement?: FocusableElement | null }): boolean;
  /** Re-reads the focusable list (for use after a state change). */
  refreshFocusable(): void;
  /** Mirror the current preferences snapshot to the caller. */
  refreshOnValueChange(values: { analytics: boolean; ads: boolean }, setState: (state: { analytics: boolean; ads: boolean }) => void): void;
  isOpen(): boolean;
}

function defaultFocus(el: FocusableElement): void {
  if (typeof el.focus === "function") el.focus();
}

export function createConsentModalController(
  deps: ConsentModalDeps = {},
): ConsentModalController {
  let opener: FocusTarget | null = null;
  let open = false;
  let focusable: readonly FocusableElement[] = [];

  const getFocusable = deps.getFocusable ?? (() => []);
  const close = deps.close ?? (() => {});
  const focusElement = deps.focusElement ?? defaultFocus;

  function captureFocusable(): void {
    focusable = (getFocusable() ?? []).filter(Boolean);
  }

  function focusFirst(): void {
    captureFocusable();
    const first = focusable[0];
    if (first) focusElement(first);
  }

  return {
    openModal(openerElement) {
      opener = openerElement ?? null;
      open = true;
      focusFirst();
    },
    closeModal() {
      if (!open) return;
      open = false;
      close();
      if (opener) focusElement(opener);
    },
    onKeyDown(event) {
      if (!open) return false;
      if (event.key === "Escape") {
        event.preventDefault?.();
        this.closeModal();
        return true;
      }
      if (event.key !== "Tab") return false;
      captureFocusable();
      const items = focusable;
      if (!items.length) {
        event.preventDefault?.();
        return true;
      }
      // Look up the current item by id so callers can pass a
      // value-equivalent activeElement without sharing references.
      const active = event.activeElement;
      const activeId = active && typeof active === "object" && "id" in active
        ? (active as FocusableElement).id
        : undefined;
      const current = activeId !== undefined
        ? items.findIndex((it) => it.id === activeId)
        : items.indexOf((active ?? {}) as FocusableElement);
      let next: number;
      if (event.shiftKey) {
        next = current <= 0 ? items.length - 1 : current - 1;
      } else {
        next = current < 0 || current === items.length - 1 ? 0 : current + 1;
      }
      event.preventDefault?.();
      const target = items[next];
      if (target) focusElement(target);
      return true;
    },
    refreshFocusable() {
      captureFocusable();
    },
    refreshOnValueChange(values, setState) {
      setState({ analytics: Boolean(values.analytics), ads: Boolean(values.ads) });
    },
    isOpen() {
      return open;
    },
  };
}
