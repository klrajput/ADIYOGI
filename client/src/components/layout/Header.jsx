import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from '../common/Logo';
import { Icon } from '../common/Icons';
import Button from '../ui/Button';
import { useIdentity } from '../../context/IdentityContext';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import useScrolled from '../../hooks/useScrolled';
import { WELLNESS_CATEGORIES } from '../../data/wellnessCategories';
import { classNames, initials } from '../../lib/format';
import MobileNav from './MobileNav';
import { CRISIS_NAV, PRIMARY_NAV } from './navigation';

function navLinkClass(light) {
  return ({ isActive }) =>
    classNames(
      'relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200',
      light
        ? isActive
          ? 'text-surface'
          : 'text-paper/75 hover:text-surface'
        : isActive
          ? 'text-primary-800'
          : 'text-ink-soft hover:text-ink',
      isActive &&
        'after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent-500 after:content-[""]'
    );
}

function NotificationsLink({ count, light }) {
  const label = typeof count === 'number' && count > 0 ? `Notifications, ${count} unread` : 'Notifications';
  return (
    <Link
      to="/notifications"
      className={classNames(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors',
        light ? 'text-paper/80 hover:bg-surface/10 hover:text-surface' : 'text-ink-muted hover:bg-primary-50 hover:text-ink'
      )}
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
 * Premium glass navigation.
 * - transparent over the cosmic hero (light text), frosted cream once scrolled
 * - gold active indicator, animated hover, accessible "Explore" dropdown
 * - anonymous identity chip, notification bell, permanent crisis affordance
 */
export default function Header() {
  const { identity, loading, refresh, isModerator, isAnonymous } = useIdentity();
  const { count } = useUnreadNotifications({ enabled: Boolean(identity) });
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const scrolled = useScrolled(16);
  const location = useLocation();
  const exploreRef = useRef(null);

  const overHero = location.pathname === '/' && !scrolled;
  const light = overHero;

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

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await refresh();
    } finally {
      setReconnecting(false);
    }
  };

  const alias = identity?.preferences?.displayAlias || identity?.alias || '';
  const isAccount = identity && identity.kind === 'user';

  return (
    <>
      <header
        className={classNames(
          'sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-500 ease-calm',
          scrolled ? 'glass-nav shadow-[0_10px_30px_-24px_rgba(8,20,32,0.55)]' : 'border-b border-transparent',
          !scrolled && !overHero && 'bg-paper/85 backdrop-blur-md'
        )}
      >
        <div className="container-page flex h-[4.25rem] items-center gap-3">
          <Logo className="-ml-1 shrink-0" light={light} />

          <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 lg:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass(light)}>
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
                className={classNames(
                  'relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                  light ? 'text-paper/75 hover:text-surface' : 'text-ink-soft hover:text-ink'
                )}
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
                  light
                    ? 'border-accent-200/50 text-accent-200 hover:bg-surface/10'
                    : isActive
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
            {identity ? <NotificationsLink count={count} light={light} /> : null}

            {loading ? (
              <span className="hidden h-8 w-32 items-center sm:flex" aria-hidden="true">
                <span className="skeleton h-8 w-full rounded-full" />
              </span>
            ) : identity ? (
              <>
                {isModerator ? (
                  <NavLink
                    to="/moderation"
                    className={classNames(
                      'hidden rounded-full px-3 py-2 text-sm font-medium md:inline-block',
                      light ? 'text-paper/75 hover:text-surface' : 'text-ink-soft hover:text-ink'
                    )}
                  >
                    Moderation
                  </NavLink>
                ) : null}
                <Link
                  to="/preferences"
                  className={classNames(
                    'hidden items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors sm:inline-flex [@media(pointer:coarse)]:min-h-[2.5rem]',
                    light
                      ? 'border-surface/25 bg-surface/10 text-paper/85 hover:bg-surface/15 hover:text-surface'
                      : 'border-line bg-surface text-ink-soft hover:border-accent-300 hover:text-ink'
                  )}
                  aria-label={`Your profile, ${alias}. Open preferences`}
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                      light ? 'bg-accent-200/25 text-accent-100' : 'bg-primary-100 text-primary-800'
                    )}
                  >
                    {initials(alias) || <Icon name="user" className="h-4 w-4" />}
                  </span>
                  <span className="max-w-[9rem] truncate font-medium">{alias || 'Anonymous'}</span>
                </Link>
                {isAnonymous ? (
                  <Link
                    to="/login"
                    state={{ from: location.pathname }}
                    className={classNames(
                      'hidden rounded-full px-3 py-2 text-sm sm:inline-block',
                      light ? 'text-paper/65 hover:text-surface' : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    Sign in
                  </Link>
                ) : isAccount ? (
                  <Link
                    to="/preferences"
                    className={classNames(
                      'hidden rounded-full px-3 py-2 text-sm md:inline-block',
                      light ? 'text-paper/65 hover:text-surface' : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    Account
                  </Link>
                ) : null}
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleReconnect} loading={reconnecting}>
                Reconnect
              </Button>
            )}

            <button
              type="button"
              className={classNames(
                '-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors lg:hidden',
                light ? 'text-paper/85 hover:bg-surface/10' : 'text-ink-soft hover:bg-primary-50'
              )}
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
