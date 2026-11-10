import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import CrisisBar from './CrisisBar';
import Footer from './Footer';
import OfflineBanner from '../common/OfflineBanner';
import ScrollToTop from '../common/ScrollToTop';

/**
 * Application shell: skip link, connectivity notice, header + crisis strip,
 * the `main` landmark and the footer.
 *
 * While the anonymous identity is still loading the shell renders immediately
 * (only the identity chip shows a skeleton) — never a full-page spinner.
 */
export default function AppLayout() {
  const mainRef = useRef(null);
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  // Route changes are not announced by browsers; move focus to the landmark so
  // keyboard and screen-reader users land at the top of the new page.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <OfflineBanner />
      <Header />
      <CrisisBar />
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
