/* ============================================
   components/drawer.js — Mobile drawer with focus trap
   ============================================ */

import { $, $$ } from '../core/dom.js';
import { trapFocus, delegate } from '../core/events.js';

/**
 * Initialize the mobile drawer.
 * @returns {() => void} cleanup
 */
export function initDrawer() {
  const drawer = $('[data-drawer]');
  if (!drawer) return () => {};

  let open = false;
  let lastTrigger = null;
  let stopTrap = null;

  const setOpen = (next) => {
    if (next === open) return;
    open = next;
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      lastTrigger = document.activeElement;
      const firstFocusable = drawer.querySelector(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) firstFocusable.focus();
      stopTrap = trapFocus(drawer, () => open);
    } else {
      if (stopTrap) { stopTrap(); stopTrap = null; }
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
    }
  };

  const cleanupOpen = delegate(document, 'click', '[data-drawer-open]', (e, target) => {
    e.preventDefault();
    setOpen(true);
  });

  const cleanupClose = delegate(document, 'click', '[data-drawer-close]', (e) => {
    e.preventDefault();
    setOpen(false);
  });

  const handleKey = (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  };
  document.addEventListener('keydown', handleKey);

  return () => {
    cleanupOpen();
    cleanupClose();
    document.removeEventListener('keydown', handleKey);
    if (stopTrap) stopTrap();
  };
}
