/* ============================================
   components/ai-insight.js — Animate probability bars
   ============================================ */

import { $$, $ } from '../core/dom.js';
import { prefersReducedMotion } from '../core/accessibility.js';

/**
 * Initialize AI Insight probability bar animations using IntersectionObserver.
 * @returns {() => void} cleanup
 */
export function initAIInsight() {
  const insights = $$('[data-ai-insight], .ff-ai-insight');
  if (insights.length === 0) return () => {};

  const reduce = prefersReducedMotion();

  for (const insight of insights) {
    const bars = $$('[data-progress]', insight);
    if (bars.length === 0) continue;

    const animate = () => {
      for (const bar of bars) {
        const target = parseFloat(bar.getAttribute('data-progress')) || 0;
        if (reduce) {
          bar.style.width = `${target}%`;
        } else {
          bar.style.transition = 'width 800ms cubic-bezier(.2,.8,.2,1)';
          bar.style.width = `${target}%`;
        }
      }
    };

    if (reduce || !('IntersectionObserver' in window)) {
      animate();
      continue;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          animate();
          observer.disconnect();
          break;
        }
      }
    }, { threshold: 0.2 });
    observer.observe(insight);
  }

  return () => {};
}
