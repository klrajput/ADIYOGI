import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SPA scroll behaviour:
 * - a route change without a hash returns to the top;
 * - a hash link (e.g. /#wisdom, /resources#wisdom) scrolls that section into view after
 *   the destination has rendered, respecting reduced motion.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return undefined;
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const targetId = decodeURIComponent(hash.slice(1));
    // Wait a frame so the route's content is mounted before measuring.
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}
