/* ============================================
   core/accessibility.js — Accessibility helpers
   ============================================ */

/**
 * Check if user prefers reduced motion.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers dark color scheme.
 * @returns {boolean}
 */
export function prefersDarkColorScheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Announce a message to assistive technology via the live region.
 * @param {string} message
 * @param {'polite'|'assertive'} [politeness]
 */
export function announce(message, politeness = 'polite') {
  if (!message) return;
  let region = document.getElementById('ff-a11y-live');
  if (!region) {
    region = document.createElement('div');
    region.id = 'ff-a11y-live';
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true');
    Object.assign(region.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0'
    });
    document.body.appendChild(region);
  }
  region.setAttribute('aria-live', politeness);
  // Clear then set to ensure the message is re-announced
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 30);
}
