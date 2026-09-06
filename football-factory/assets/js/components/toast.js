/* ============================================
   components/toast.js — Toast notifications
   ============================================ */

import { $$, $ } from '../core/dom.js';

const DEFAULT_DURATION = 3500;

/**
 * Initialize toast triggers.
 * @returns {() => void} cleanup
 */
export function initToast() {
  const toast = $('[data-toast]');
  if (!toast) return () => {};
  let timer = null;

  const show = (message, type = 'info') => {
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add('is-visible');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, DEFAULT_DURATION);
  };

  const cleanups = [];
  const triggers = $$('[data-toast-trigger]');
  for (const el of triggers) {
    const handler = (e) => {
      e.preventDefault();
      const msg = el.getAttribute('data-toast-trigger') || 'การแจ้งเตือน';
      const type = el.getAttribute('data-toast-type') || 'info';
      show(msg, type);
    };
    el.addEventListener('click', handler);
    cleanups.push(() => el.removeEventListener('click', handler));
  }

  return () => {
    for (const fn of cleanups) fn();
    if (timer) clearTimeout(timer);
  };
}
