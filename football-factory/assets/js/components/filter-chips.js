/* ============================================
   components/filter-chips.js — Single/multi select chips
   ============================================ */

import { $$, $ } from '../core/dom.js';

/**
 * Initialize filter chips.
 * @returns {() => void} cleanup
 */
export function initFilterChips() {
  const groups = $$('[data-filter-chips]');
  if (groups.length === 0) return () => {};

  const cleanups = [];

  for (const group of groups) {
    const mode = group.getAttribute('data-filter-chips') === 'multi' ? 'multi' : 'single';
    const chips = $$('.ff-filter-chip', group);
    const targetSelector = group.getAttribute('data-filter-target');
    const target = targetSelector ? $(targetSelector) : null;
    const items = target ? $$('[data-filter-item]', target) : [];

    const apply = () => {
      const activeValues = chips
        .filter((c) => c.getAttribute('aria-pressed') === 'true')
        .map((c) => c.getAttribute('data-filter-value') || c.textContent.trim());
      for (const item of items) {
        const v = item.getAttribute('data-filter-item');
        const visible = activeValues.length === 0 || activeValues.includes(v);
        item.hidden = !visible;
      }
    };

    for (const chip of chips) {
      const click = (e) => {
        e.preventDefault();
        const isActive = chip.getAttribute('aria-pressed') === 'true';
        if (mode === 'single') {
          for (const c of chips) c.setAttribute('aria-pressed', 'false');
        }
        chip.setAttribute('aria-pressed', isActive ? 'false' : 'true');
        apply();
      };
      chip.addEventListener('click', click);
      cleanups.push(() => chip.removeEventListener('click', click));
    }
  }

  return () => { for (const fn of cleanups) fn(); };
}
