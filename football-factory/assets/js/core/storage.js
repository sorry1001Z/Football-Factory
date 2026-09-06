/* ============================================
   core/storage.js — localStorage wrapper
   Safe for SSR / private browsing.
   ============================================ */

const memory = new Map();

function safeLocal() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__ff_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch (e) {
    return null;
  }
}

const store = safeLocal();

/**
 * Read a value from storage. Falls back to memory if localStorage is unavailable.
 * @param {string} key
 * @param {*} [fallback]
 * @returns {*}
 */
export function getItem(key, fallback = null) {
  if (store) {
    const v = store.getItem(key);
    if (v == null) return fallback;
    try { return JSON.parse(v); } catch { return v; }
  }
  return memory.has(key) ? memory.get(key) : fallback;
}

/**
 * Write a value to storage.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} success
 */
export function setItem(key, value) {
  if (store) {
    try {
      store.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  memory.set(key, value);
  return true;
}

/**
 * Remove a value from storage.
 * @param {string} key
 * @returns {boolean}
 */
export function removeItem(key) {
  if (store) { store.removeItem(key); return true; }
  memory.delete(key);
  return true;
}
