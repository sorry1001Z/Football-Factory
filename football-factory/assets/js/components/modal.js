/* ============================================
   components/modal.js — Modal dialogs
   ============================================ */

import { $$, $ } from '../core/dom.js';
import { delegate, trapFocus } from '../core/events.js';

/**
 * Initialize modal triggers.
 * @returns {() => void} cleanup
 */
export function initModal() {
  const cleanups = [];

  const openModal = (modal) => {
    if (!modal) return;
    modal.hidden = false;
    modal.dataset.open = 'true';
    const previouslyFocused = document.activeElement;
    modal._previouslyFocused = previouslyFocused;
    const firstFocusable = modal.querySelector(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) firstFocusable.focus();
    modal._stopTrap = trapFocus(modal, () => modal.dataset.open === 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.hidden = true;
    modal.dataset.open = 'false';
    if (modal._stopTrap) { modal._stopTrap(); delete modal._stopTrap; }
    if (modal._previouslyFocused && typeof modal._previouslyFocused.focus === 'function') {
      modal._previouslyFocused.focus();
      delete modal._previouslyFocused;
    }
    document.body.style.overflow = '';
  };

  cleanups.push(delegate(document, 'click', '[data-modal-open]', (e, target) => {
    e.preventDefault();
    const sel = target.getAttribute('data-modal-open');
    openModal($(sel));
  }));

  cleanups.push(delegate(document, 'click', '[data-modal-close]', (e) => {
    e.preventDefault();
    const modal = e.target.closest('[role="dialog"], [data-modal]');
    if (modal) closeModal(modal);
  }));

  const handleKey = (e) => {
    if (e.key !== 'Escape') return;
    const open = $('[data-modal][data-open="true"]');
    if (open) closeModal(open);
  };
  document.addEventListener('keydown', handleKey);
  cleanups.push(() => document.removeEventListener('keydown', handleKey));

  return () => { for (const fn of cleanups) fn(); };
}
