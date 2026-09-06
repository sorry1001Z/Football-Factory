/* ============================================
   components/match-center.js — Match center helpers
   ============================================ */

import { $$, $ } from '../core/dom.js';
import { delegate } from '../core/events.js';

/**
 * Initialize match-center tabs and date strip.
 * @returns {() => void} cleanup
 */
export function initMatchCenter() {
  const cleanups = [];

  // Date strip selection (visual only; non-functional in static demo)
  const dateItems = $$('.ff-date-strip__item');
  for (const item of dateItems) {
    const handler = (e) => {
      e.preventDefault();
      for (const d of dateItems) d.classList.remove('is-active');
      item.classList.add('is-active');
    };
    item.addEventListener('click', handler);
    cleanups.push(() => item.removeEventListener('click', handler));
  }

  // Auto-refresh indicator (visual only)
  const refresh = $('[data-refresh-indicator]');
  if (refresh) {
    let visible = false;
    const toggle = () => {
      visible = !visible;
      refresh.hidden = !visible;
    };
    const id = setInterval(toggle, 8000);
    cleanups.push(() => clearInterval(id));
  }

  return () => { for (const fn of cleanups) fn(); };
}
