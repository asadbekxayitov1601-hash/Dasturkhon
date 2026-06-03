import { useEffect } from 'react';

/**
 * Reveals elements with the `.animate-fade-up` class as they scroll into view
 * (adds `.is-visible`). One observer covers the whole app, and a MutationObserver
 * picks up elements added later (route changes, async data). Elements already in
 * view on load reveal immediately.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Fallback: if the browser lacks IntersectionObserver, reveal everything so
    // content is never stuck hidden.
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.animate-fade-up').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
    );

    const observeAll = () => {
      document.querySelectorAll('.animate-fade-up:not(.is-visible)').forEach((el) => io.observe(el));
    };

    observeAll();

    // Re-scan when the DOM changes (navigation, lists loading in).
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(observeAll);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
}
