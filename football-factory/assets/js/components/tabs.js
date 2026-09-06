/* ============================================
   components/tabs.js — Tabs with WAI-ARIA keyboard behavior
   ============================================ */

import { $$, $ } from '../core/dom.js';

/**
 * Initialize tabs.
 * @returns {() => void} cleanup
 */
export function initTabs() {
  const groups = $$('[data-tabs]');
  if (groups.length === 0) return () => {};

  const cleanups = [];

  for (const group of groups) {
    const tabs = $$('[role="tab"]', group);
    const panelsByName = new Map();
    for (const tab of tabs) {
      const name = tab.getAttribute('data-tab');
      if (!name) continue;
      const panel = $(`[data-tab-panel="${name}"]`);
      if (panel) panelsByName.set(name, panel);
    }

    const activate = (tab) => {
      for (const t of tabs) {
        const isActive = t === tab;
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        t.setAttribute('tabindex', isActive ? '0' : '-1');
        const name = t.getAttribute('data-tab');
        const panel = name ? panelsByName.get(name) : null;
        if (panel) {
          panel.hidden = !isActive;
        }
      }
    };

    for (const tab of tabs) {
      tab.setAttribute('tabindex', tab.getAttribute('aria-selected') === 'true' ? '0' : '-1');
      const click = (e) => { e.preventDefault(); activate(tab); tab.focus(); };
      tab.addEventListener('click', click);

      const key = (e) => {
        const idx = tabs.indexOf(tab);
        let next = -1;
        if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next >= 0) {
          e.preventDefault();
          activate(tabs[next]);
          tabs[next].focus();
        }
      };
      tab.addEventListener('keydown', key);

      cleanups.push(() => {
        tab.removeEventListener('click', click);
        tab.removeEventListener('keydown', key);
      });
    }
  }

  return () => { for (const fn of cleanups) fn(); };
}
