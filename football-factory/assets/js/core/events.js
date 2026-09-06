/* ============================================
   core/events.js — Event utilities
   No globals. Pure helpers.
   ============================================ */

/**
 * Add a delegated event listener to a root element.
 * @param {HTMLElement} root
 * @param {string} type
 * @param {string} selector
 * @param {Function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {Function} unsubscribe
 */
export function delegate(root, type, selector, handler, options) {
  if (!root) return () => {};
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (!target || !root.contains(target)) return;
    handler.call(target, event, target);
  };
  root.addEventListener(type, listener, options);
  return () => root.removeEventListener(type, listener, options);
}

/**
 * Listen once for a matching event. Returns a Promise.
 * @param {HTMLElement} root
 * @param {string} type
 * @param {string} [selector] — if provided, delegated
 * @returns {Promise<Event>}
 */
export function once(root, type, selector) {
  return new Promise((resolve) => {
    const handler = (e) => {
      if (selector) {
        const target = e.target.closest(selector);
        if (!target || !root.contains(target)) return;
      }
      root.removeEventListener(type, handler, true);
      resolve(e);
    };
    root.addEventListener(type, handler, true);
  });
}

/**
 * Trap focus inside a container while a condition is true.
 * Restores focus to the previously-focused element on release.
 * @param {HTMLElement} container
 * @param {() => boolean} isActive
 * @returns {Function} stop
 */
export function trapFocus(container, isActive) {
  if (!container) return () => {};
  let previouslyFocused = null;

  const handleKeydown = (event) => {
    if (event.key !== 'Tab') return;
    if (!isActive()) return;
    const focusable = Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
        ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', handleKeydown, true);

  return () => {
    document.removeEventListener('keydown', handleKeydown, true);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
}

/**
 * Pause CSS animations/transitions until next frame.
 * Useful when synchronizing rapid show/hide of elements.
 * @returns {Promise<void>}
 */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
