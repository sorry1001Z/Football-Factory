/* ============================================
   components/theme-toggle.js — Light/Dark theme
   ============================================ */

import { $$, $ } from '../core/dom.js';
import { getItem, setItem } from '../core/storage.js';
import { prefersDarkColorScheme } from '../core/accessibility.js';

const THEME_KEY = 'ff-theme';

/**
 * Get the preferred theme (storage > system > light).
 * @returns {'light' | 'dark'}
 */
function getPreferredTheme() {
  const stored = getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDarkColorScheme() ? 'dark' : 'light';
}

/**
 * Apply a theme to the document.
 * @param {'light' | 'dark'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const buttons = $$('[data-theme-toggle]');
  for (const btn of buttons) {
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด');
    const iconLight = $('[data-theme-icon="light"]', btn);
    const iconDark = $('[data-theme-icon="dark"]', btn);
    if (iconLight) iconLight.style.display = theme === 'dark' ? 'block' : 'none';
    if (iconDark) iconDark.style.display = theme === 'dark' ? 'none' : 'block';
  }
}

/**
 * Initialize theme toggle.
 * @returns {() => void} cleanup
 */
export function initThemeToggle() {
  applyTheme(getPreferredTheme());

  const handleClick = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setItem(THEME_KEY, next);
    applyTheme(next);
  };

  const buttons = $$('[data-theme-toggle]');
  for (const btn of buttons) btn.addEventListener('click', handleClick);

  return () => {
    for (const btn of buttons) btn.removeEventListener('click', handleClick);
  };
}
