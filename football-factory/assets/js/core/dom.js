/* ============================================
   core/dom.js — DOM utilities
   No globals. Pure helpers.
   ============================================ */

/**
 * Get an HTMLElement by CSS selector. Returns null if not found.
 * @param {string} sel
 * @param {ParentNode} [scope]
 * @returns {HTMLElement | null}
 */
export function $(sel, scope = document) {
  return scope.querySelector(sel);
}

/**
 * Get all HTMLElements matching a CSS selector. Returns empty array.
 * @param {string} sel
 * @param {ParentNode} [scope]
 * @returns {HTMLElement[]}
 */
export function $$(sel, scope = document) {
  return Array.from(scope.querySelectorAll(sel));
}

/**
 * Create an HTMLElement with attributes and children.
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {(Node|string)[]} [children]
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class' || k === 'className') {
      el.className = v;
    } else if (k === 'dataset') {
      Object.assign(el.dataset, v);
    } else if (k.startsWith('aria-') || k === 'role' || k === 'for' || k === 'tabindex') {
      el.setAttribute(k.replace(/([A-Z])/g, '-$1').toLowerCase(), v);
    } else if (k === 'text') {
      el.textContent = v;
    } else if (k === 'html') {
      el.innerHTML = v;
    } else if (v !== null && v !== undefined && v !== false) {
      el.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/**
 * Get all focusable descendants within a root.
 * @param {HTMLElement} root
 * @returns {HTMLElement[]}
 */
export function getFocusable(root) {
  if (!root) return [];
  return $$((
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
    ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]),' +
    ' audio[controls], video[controls], [contenteditable]:not([contenteditable="false"])'
  ), root);
}

/**
 * Get the closest focusable parent of an element.
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
export function getClosestFocusable(el) {
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.matches('a[href], button, [tabindex]:not([tabindex="-1"])')) return cur;
    cur = cur.parentElement;
  }
  return null;
}
