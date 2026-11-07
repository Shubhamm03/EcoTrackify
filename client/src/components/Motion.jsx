import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// App-wide motion, display only. Every card, table row, list item and tile on every page
// glides in when it first appears on screen (top to bottom, slightly staggered), and a thin
// bar sweeps across the top when you move between pages. Nothing here touches data or logic:
// it only adds CSS classes. With "reduce motion" switched on, nothing is hidden or animated.
const TARGETS = [
  '.card', '.table tbody tr', '.list-item', '.stat-tile', '.quick-tile', '.cat-tile', '.badge', '.post', '.reply',
  '.goal-row', '.podium-step', '.type-card', '.compare-col', '.source-tile', '.alert', '.insight', '.empty',
  '.bubble', '.suggest-list li', '.kv > div', '.details > div', '.feat-card', '.chips', '.tabs', '.seg-tabs',
  '.filter-bar', '.custom-goal-bar', '.stat-strip .stat', '.topbar', '.app-footer', '.footer-grid > div',
].join(', ');
// Areas that already have their own entrance animation
const SKIP = '.modal, .modal-backdrop, .toast-wrap, .hero, .stagger, .on-scroll, .reveal-up, .sidebar, .mobile-nav, .mobile-top';

export default function Motion() {
  const location = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window) || !('MutationObserver' in window)) return undefined;

    const io = new IntersectionObserver((entries) => {
      // Reveal in reading order, a little apart, so a page fills in smoothly
      const shown = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left));
      shown.forEach((en, i) => {
        const el = en.target;
        el.style.setProperty('--rv-d', `${Math.min(i, 10) * 45}ms`);
        el.classList.add('rv-in');
        io.unobserve(el);
        // Tidy up once the animation has finished, so hover effects behave normally afterwards
        setTimeout(() => { el.classList.remove('rv', 'rv-in'); el.style.removeProperty('--rv-d'); }, 1400);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -3% 0px' });

    const prepare = (root) => {
      if (!(root instanceof Element)) return;
      const list = root.matches?.(TARGETS) ? [root, ...root.querySelectorAll(TARGETS)] : root.querySelectorAll(TARGETS);
      list.forEach((el) => {
        if (el.dataset.rv || el.closest(SKIP)) return;
        el.dataset.rv = '1';
        el.classList.add('rv');
        io.observe(el);
      });
    };

    prepare(document.body);
    let queued = [];
    let frame = 0;
    const mo = new MutationObserver((records) => {
      records.forEach((r) => r.addedNodes.forEach((n) => queued.push(n)));
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; const q = queued; queued = []; q.forEach(prepare); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  // A thin progress bar sweeps across the top on every page change
  return <div key={location.pathname} className="route-bar" aria-hidden="true" />;
}
