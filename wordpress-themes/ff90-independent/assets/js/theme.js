/* Original FF90 navigation and local display preference. GPL-3.0-or-later. */
(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.querySelector('.mode-toggle');
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-menu');
  let mode = 'light';
  try { mode = localStorage.getItem('ff90-color-mode') === 'dark' ? 'dark' : 'light'; } catch (_) { /* Storage is optional. */ }
  const setMode = (next) => {
    root.dataset.colorMode = next;
    if (toggle) toggle.setAttribute('aria-pressed', String(next === 'dark'));
  };
  setMode(mode);
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const next = root.dataset.colorMode === 'dark' ? 'light' : 'dark';
      setMode(next);
      try { localStorage.setItem('ff90-color-mode', next); } catch (_) { /* Keep session preference. */ }
    });
  }
  if (menuButton && menu) {
    menuButton.hidden = false;
    root.classList.add('has-menu-js');
    const close = () => { menuButton.setAttribute('aria-expanded', 'false'); menu.classList.remove('is-open'); };
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('is-open', !expanded);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { close(); menuButton.focus(); }
    });
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target) && !menuButton.contains(event.target)) close();
    });
  }
})();
