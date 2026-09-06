/* ============================================
   components/ticker.js — Live ticker (pausable)
   ============================================ */

import { $$, $ } from '../core/dom.js';
import { prefersReducedMotion } from '../core/accessibility.js';

/**
 * Initialize live ticker animations. Pauses on hover or focus.
 * @returns {() => void} cleanup
 */
export function initTicker() {
  const tickers = $$('[data-ticker-track]');
  if (tickers.length === 0) return () => {};
  if (prefersReducedMotion()) return () => {};

  const cleanups = [];

  for (const track of tickers) {
    const pause = () => { track.style.animationPlayState = 'paused'; };
    const play = () => { track.style.animationPlayState = 'running'; };
    track.addEventListener('mouseenter', pause);
    track.addEventListener('mouseleave', play);
    track.addEventListener('focusin', pause);
    track.addEventListener('focusout', play);
    cleanups.push(() => {
      track.removeEventListener('mouseenter', pause);
      track.removeEventListener('mouseleave', play);
      track.removeEventListener('focusin', pause);
      track.removeEventListener('focusout', play);
    });
  }

  return () => { for (const fn of cleanups) fn(); };
}
