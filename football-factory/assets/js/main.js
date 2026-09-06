/* ============================================
   main.js — Football Factory Theme runtime (Phase 6C)
   ============================================
   The shell-only runtime for the production global shell.
   This module is a strict superset of placeholder behavior;
   it implements only the interactions the Phase 6C shell needs:

     - Theme toggle (light / dark / system) with localStorage
       persistence and pre-paint coordination.
     - Mobile drawer open / close with focus trap, escape,
       and reduced-motion handling.
     - Search overlay open / close with the same focus-trap
       pattern as the drawer.
     - Sticky header — toggles `is-stuck` after a scroll
       threshold.
     - Back-to-top — appears after a scroll threshold and
       smooth-scrolls to the top, respecting reduced motion.
     - Bottom-nav — current-page highlight (already server-
       rendered via the walker, this just enforces the
       active class after a programmatic nav).
     - Sprite hydration — the inline sprite in the header
       is mirrored into a hidden div so `<use href="#i-...">`
       references resolve even before the sprite asset is
       fetched (defensive).

   NO business logic. NO API calls. NO dynamic content.
   ============================================ */

const THEME_KEY = 'ff-theme';
const THEME_DEFAULT = 'light';

/* ---------- helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- pre-paint coordination ----------
   The inline script in header.php already set `data-theme` BEFORE
   first paint. This module's job is to:
     1. Read what the inline script set.
     2. Sync the toggle button state.
     3. Wire the click handler.
   The localStorage write happens in both places (inline + here)
   so the system preference is captured the first time the user
   clicks the toggle.
*/
function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch (e) { /* localStorage unavailable */ }
  return null;
}
function systemTheme() {
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'dark' : 'light';
}
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || THEME_DEFAULT;
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  $$('[data-ff-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute(
      'aria-label',
      theme === 'dark'
        ? (btn.getAttribute('data-ff-label-light') || 'Switch to light mode')
        : (btn.getAttribute('data-ff-label-dark') || 'Switch to dark mode')
    );
    const lightIcon = $('[data-ff-theme-icon="light"]', btn);
    const darkIcon  = $('[data-ff-theme-icon="dark"]', btn);
    if (lightIcon) lightIcon.style.display = theme === 'dark' ? 'none' : '';
    if (darkIcon)  darkIcon.style.display  = theme === 'dark' ? '' : 'none';
  });
}

/* ---------- drawer (mobile) ----------
   The drawer is a `<div role="dialog" aria-modal="true">`.
   On open:
     - Save the previous active element.
     - Move focus to the first focusable inside the panel.
     - Trap Tab focus within the panel.
     - Listen for Escape to close.
     - Block body scroll.
   On close:
     - Restore focus to the trigger.
     - Unblock body scroll.
     - Release the focus trap.
*/
function trapFocus(container, onEscape) {
  const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last  = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !container.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}
function initOverlay({
  triggerSelector,
  panelSelector,
  closeSelector,
  openAttr = 'data-ff-drawer-open',
  stateAttr = 'data-ff-drawer',
  bodyLockClass = 'ff-body-locked',
}) {
  const triggers = $$(triggerSelector);
  const panel    = $(panelSelector);
  if (!triggers.length || !panel) return () => {};
  let open = false;
  let lastTrigger = null;
  let stopTrap = null;
  const setOpen = (next) => {
    if (next === open) return;
    open = next;
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle(bodyLockClass, open);
    triggers.forEach((t) => t.setAttribute('aria-expanded', open ? 'true' : 'false'));
    if (open) {
      lastTrigger = document.activeElement;
      const first = panel.querySelector('a[href], button:not([disabled])');
      if (first) first.focus();
      stopTrap = trapFocus(panel, () => setOpen(false));
    } else {
      if (stopTrap) { stopTrap(); stopTrap = null; }
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
    }
  };
  const onTriggerClick = (e) => { e.preventDefault(); setOpen(true); };
  const onCloseClick   = (e) => { e.preventDefault(); setOpen(false); };
  triggers.forEach((t) => t.addEventListener('click', onTriggerClick));
  const closeEls = $$(closeSelector, panel);
  closeEls.forEach((c) => c.addEventListener('click', onCloseClick));
  // Wire [data-ff-drawer-open] also (for any element with the
  // attribute that wasn't in the initial triggers list — e.g.,
  // dynamic elements).
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[' + openAttr + ']');
    if (!target || triggers.indexOf(target) !== -1) return;
    e.preventDefault();
    setOpen(true);
  });
  return () => {
    triggers.forEach((t) => t.removeEventListener('click', onTriggerClick));
    closeEls.forEach((c) => c.removeEventListener('click', onCloseClick));
    if (stopTrap) stopTrap();
  };
}

/* ---------- sticky header ---------- */
function initSticky() {
  const header = $('[data-ff-sticky]');
  if (!header) return () => {};
  const threshold = parseInt(header.getAttribute('data-ff-sticky-show-at') || '0', 10);
  let last = false;
  const onScroll = () => {
    const stuck = window.scrollY > threshold;
    if (stuck === last) return;
    last = stuck;
    header.classList.toggle('is-stuck', stuck);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return () => window.removeEventListener('scroll', onScroll);
}

/* ---------- back to top ---------- */
function initBackToTop() {
  const btn = $('[data-ff-back-to-top]');
  if (!btn) return () => {};
  const showAt = parseInt(btn.getAttribute('data-ff-back-to-top-show-at') || '600', 10);
  let last = false;
  const onScroll = () => {
    const visible = window.scrollY > showAt;
    if (visible === last) return;
    last = visible;
    btn.classList.toggle('is-visible', visible);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  onScroll();
  return () => window.removeEventListener('scroll', onScroll);
}

/* ---------- bottom-nav current-page highlight (defensive) ----------
   The walker already marks current items. This ensures the
   visual state survives any client-side route change.
*/
function initBottomNav() {
  $$('.ff-bottom-nav [data-ff-current="true"]').forEach((el) => {
    el.classList.add('is-current');
  });
}

/* ---------- tap-stop placeholders ----------
   The header/footer contains `<a href="#" data-ff-tap-stop>` for
   not-yet-implemented destinations. In Phase 6C, those are
   simply suppressed (the link's default action is cancelled
   so we don't pollute history with `#`). The runtime toast
   that the Enterprise Frontend uses is intentionally NOT
   shipped — Phase 6D will replace these with real pages.
*/
function initTapStop() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-ff-tap-stop]');
    if (!target) return;
    e.preventDefault();
  });
}

/* ---------- sprite hydration (defensive) ----------
   The header PHP inlines the sprite (via `file_get_contents`).
   This is a no-op if the sprite is already inlined. If the
   inline injection failed (file_get_contents blocked or
   asset missing), the runtime fetches the sprite as a
   fallback so `<use href="#i-...">` still works.
*/
function initSprite() {
  const host = document.getElementById('ff-icons');
  if (!host) return;
  if (host.children.length > 0) return; // already inlined
  const url = host.getAttribute('data-ff-sprite-url') || '/wp-content/themes/football-factory/assets/icons/sprite.svg';
  fetch(url, { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.text() : ''))
    .then((txt) => { if (txt) host.innerHTML = txt; })
    .catch(() => { /* noop; the icons will simply not appear */ });
}

/* ---------- boot ---------- */
function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

ready(() => {
  // 1. Sync theme button to whatever the inline script set.
  applyTheme(currentTheme());

  // 2. Wire toggle.
  $$('[data-ff-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  });

  // 3. Watch system theme changes (only when user has not
  //    explicitly chosen one).
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getStoredTheme() === null) {
        applyTheme(systemTheme());
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
    } else if (mq.addListener) {
      mq.addListener(onChange);
    }
  }

  // 4. Drawer + Search overlay (use the same overlay engine
  //    but with different selectors).
  const drawerCleanup = initOverlay({
    triggerSelector: '[data-ff-drawer-open][aria-controls="ff-drawer"]',
    panelSelector:   '#ff-drawer',
    closeSelector:   '[data-ff-drawer-close]',
    openAttr:        'data-ff-drawer-open',
    stateAttr:       'data-ff-drawer',
    bodyLockClass:   'ff-body-locked-drawer',
  });
  const searchCleanup = initOverlay({
    triggerSelector: '[data-ff-search-open]',
    panelSelector:   '#ff-search-overlay',
    closeSelector:   '[data-ff-search-close]',
    openAttr:        'data-ff-search-open',
    stateAttr:       'data-ff-search',
    bodyLockClass:   'ff-body-locked-search',
  });

  // 5. Sticky + back-to-top + bottom-nav + tap-stop + sprite.
  const stickyCleanup   = initSticky();
  const backToTopCleanup = initBackToTop();
  initBottomNav();
  initTapStop();
  initSprite();

  // 6. Expose cleanup for hot-reload / test environments.
  window.__ff_cleanup = () => {
    try { drawerCleanup(); }  catch (e) { /* ignore */ }
    try { searchCleanup(); } catch (e) { /* ignore */ }
    try { stickyCleanup(); } catch (e) { /* ignore */ }
    try { backToTopCleanup(); } catch (e) { /* ignore */ }
  };
});
