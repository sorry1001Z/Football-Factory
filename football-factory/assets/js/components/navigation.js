/* ============================================
   components/navigation.js — Mark current nav link
   ============================================ */

import { $$ } from '../core/dom.js';

/**
 * Add aria-current="page" to the nav link that points to the current page.
 * @returns {() => void} no-op cleanup
 */
export function initNavigation() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const file = path.split('/').pop() || 'index.html';
  const links = $$('.ff-nav__link[data-nav], .ff-bottom-nav__item[data-nav], .ff-drawer__nav a[data-nav]');
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href === file || (file === '' && href === 'index.html')) {
      link.setAttribute('aria-current', 'page');
    }
  }
  return () => {};
}
