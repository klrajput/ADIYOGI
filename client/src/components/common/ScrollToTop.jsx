import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Restores scroll position to the top on route changes (SPA behaviour). */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}
