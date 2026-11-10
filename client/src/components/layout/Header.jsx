import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from '../common/Logo';
import { Icon } from '../common/Icons';
import { useIdentity } from '../../context/IdentityContext';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import useScrolled from '../../hooks/useScrolled';
import { WELLNESS_CATEGORIES } from '../../data/wellnessCategories';
import { classNames, initials } from '../../lib/format';
import MobileNav from './MobileNav';
import { CRISIS_NAV, PRIMARY_NAV } from './navigation';

function navLinkClass({ isActive }) {
  return classNames(
    'relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200',
    isActive
      ? 'text-primary-800 after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent-500 after:content-[""]'
      : 'text-ink-soft hover:text-ink'
  );
}

function NotificationsLink({ count }) {
  const label = typeof count === 'number' && count > 0 ? `Notifications, ${count} unread` : 'Notifications';
  return (
    <Link
      to="/notifications"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-ink"
      aria-label={label}
    >
      <Icon name="bell" className="h-5 w-5" />
      {typeof count === 'number' && count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold leading-none text-[#2A1D08]"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Glass navigation.
 *
 * The bar is ALWAYS a legible frosted cream surface with dark text and a gold hairline —
 * an earlier version turned transparent over the cosmic hero, which read as "washed out"
 * on real screens. Scrolling only deepens the blur/shadow.
 *
 * Sign in / Create account are always reachable (anonymous use never requires them, but
 * they must be discoverable). Connection failure is surfaced by <ServerStatusBanner>,
 * never by an unexplained "Reconnect" button in the corner.
 */
export default function Header() {
  const { identity, loading, isModerator } = useIdentity();
  const { count } = useUnreadNotifications({ enabled: Boolean(identity) });
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const scrolled = useScrolled(16);
  const location = useLocation();
  const exploreRef = useRef(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    setExploreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!exploreOpen) return undefined;
    const onPointerDown = (event) => {
      if (!exploreRef.current?.contains(event.target)) setExploreOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExploreOpen(false);
        exploreRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [exploreOpen]);

  const alias = identity?.preferences?.displayAlias || identity?.alias || '';
  const isAccount = identity && identity.kind === 'user';
  const showAuthLinks = !loading && !isAccount;

  return (
    <>
      <header
        className={classNames(
          'sticky top-0 z-40 border-b border-accent-200/40 transition-shadow duration-300 ease-calm',
          'bg-paper/90 backdrop-blur-xl supports-[backdrop-filter]:bg-paper/80',
          scrolled && 'shadow-[0_10px_30px_-24px_rgba(8,20,32,0.55)]'
        )}
      >
        <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-accent-400/60 to-transparent" />
        <div className="container-page flex h-[4.25rem] items-center gap-3">
          <Logo className="-ml-1 shrink-0" />

          <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 lg:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}

            {/* Explore dropdown: the eight wellness spaces */}
            <div className="relative" ref={exploreRef}>
              <button
                type="button"
                onClick={() => setExploreOpen((open) => !open)}
                aria-expanded={exploreOpen}
                aria-controls="explore-menu"
                className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors duration-200 hover:text-ink"
              >
                Explore
                <svg
                  viewBox="0 0 16 16"
                  className={classNames('h-3.5 w-3.5 transition-transform duration-300', exploreOpen && 'rotate-180')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {exploreOpen ? (
                <div
                  id="explore-menu"
                  className="absolute left-1/2 top-[calc(100%+0.75rem)] w-[30rem] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur-xl"
                >
                  <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    Wellness spaces
                  </p>
                  <ul className="grid grid-cols-2 gap-1">
                    {WELLNESS_CATEGORIES.map((category) => (
                      <li key={category.slug}>
                        <Link
                          to={`/boards/${encodeURIComponent(category.boardSlug)}`}
                          className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-800"
                        >
                          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
                          <span>
                            <span className="block font-medium">{category.name}</span>
                            <span className="block text-xs text-ink-faint">{category.tagline}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="rule-gold my-2" />
                  <Link
                    to="/community"
                    className="flex items-center justify-between rounded-xl px-2.5 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
                  >
                    All community spaces
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : null}
            </div>

            <NavLink
              to={CRISIS_NAV.to}
              className={({ isActive }) =>
                classNames(
                  'ml-1 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'border-crisis-300 bg-crisis-50 text-crisis-700'
                    : 'border-crisis-200 text-crisis-600 hover:bg-crisis-50'
                )
              }
            >
              <Icon name="heart" className="h-4 w-4" />
              {CRISIS_NAV.label}
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {identity ? <NotificationsLink count={count} /> : null}

            {loading ? (
              <span className="hidden h-8 w-32 items-center sm:flex" aria-hidden="true">
                <span className="skeleton h-8 w-full rounded-full" />
              </span>
            ) : isAccount ? (
              <>
                {isModerator ? (
                  <NavLink
                    to="/moderation"
                    className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink md:inline-block"
                  >
                    Moderation
                  </NavLink>
                ) : null}
                <Link
                  to="/preferences"
                  className="hidden items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm text-ink-soft transition-colors hover:border-accent-300 hover:text-ink sm:inline-flex [@media(pointer:coarse)]:min-h-[2.5rem]"
                  aria-label={`Your profile, ${alias}. Open preferences`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800"
                  >
                    {initials(alias) || <Icon name="user" className="h-4 w-4" />}
                  </span>
                  <span className="max-w-[9rem] truncate font-medium">{alias || 'Account'}</span>
                </Link>
              </>
            ) : null}

            {showAuthLinks ? (
              <div className="flex items-center gap-1.5">
                <Link
                  to="/login"
                  state={{ from: location.pathname }}
                  className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-block"
                >
                  Sign in
                </Link>
                <Link
                  to="/login?mode=register"
                  state={{ from: location.pathname }}
                  className="hidden rounded-full border border-primary-300 bg-primary-50 px-3.5 py-1.5 text-sm font-semibold text-primary-800 transition-colors hover:border-primary-500 hover:bg-primary-100 sm:inline-block [@media(pointer:coarse)]:min-h-[2.5rem]"
                >
                  Create account
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-primary-50 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>
      <MobileNav open={menuOpen} onClose={closeMenu} />
    </>
  );
}
