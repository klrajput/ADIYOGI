import { useCallback, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from '../common/Logo';
import { Icon } from '../common/Icons';
import Button from '../ui/Button';
import { useIdentity } from '../../context/IdentityContext';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { classNames, initials } from '../../lib/format';
import MobileNav from './MobileNav';
import { CRISIS_NAV, PRIMARY_NAV } from './navigation';

function navLinkClass({ isActive }) {
  return classNames(
    'rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150',
    isActive ? 'bg-primary-50 text-primary-800' : 'text-ink-soft hover:bg-paper hover:text-ink'
  );
}

function crisisLinkClass({ isActive }) {
  return classNames(
    'inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150',
    isActive ? 'bg-crisis-50 text-crisis-700' : 'text-crisis-600 hover:bg-crisis-50'
  );
}

function NotificationsLink({ count }) {
  const label =
    typeof count === 'number' && count > 0 ? `Notifications, ${count} unread` : 'Notifications';
  return (
    <Link
      to="/notifications"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-paper hover:text-ink"
      aria-label={label}
    >
      <Icon name="bell" className="h-5 w-5" />
      {typeof count === 'number' && count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-crisis-500 px-1 text-[10px] font-semibold leading-none text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Application header: primary navigation, anonymous identity chip, notification
 * bell, moderator entry point and the accessible mobile drawer trigger.
 * The crisis affordance is a permanent, visually calm item in the navigation.
 */
export default function Header() {
  const { identity, loading, refresh, isModerator, isAnonymous } = useIdentity();
  const { count } = useUnreadNotifications({ enabled: Boolean(identity) });
  const [menuOpen, setMenuOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const location = useLocation();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center gap-3">
          <Logo className="-ml-1 shrink-0" />

          <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 lg:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to={CRISIS_NAV.to} className={crisisLinkClass}>
              <Icon name={CRISIS_NAV.icon} className="h-4 w-4" />
              {CRISIS_NAV.label}
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {identity ? <NotificationsLink count={count} /> : null}

            {loading ? (
              <span className="hidden h-8 w-32 items-center sm:flex" aria-hidden="true">
                <span className="skeleton h-8 w-full rounded-full" />
              </span>
            ) : identity ? (
              <>
                {isModerator ? (
                  <NavLink
                    to="/moderation"
                    className="hidden rounded-md px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink md:inline-block"
                  >
                    Moderation
                  </NavLink>
                ) : null}
                <Link
                  to="/preferences"
                  className="hidden items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:inline-flex [@media(pointer:coarse)]:min-h-[2.5rem]"
                  aria-label={`Your profile, ${alias}. Open preferences`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800"
                  >
                    {initials(alias) || <Icon name="user" className="h-4 w-4" />}
                  </span>
                  <span className="max-w-[9rem] truncate font-medium">{alias || 'Anonymous'}</span>
                </Link>
                {isAnonymous ? (
                  <Link
                    to="/login"
                    state={{ from: location.pathname }}
                    className="hidden rounded-md px-3 py-2.5 text-sm text-ink-muted hover:text-ink sm:inline-block"
                  >
                    Sign in
                  </Link>
                ) : isAccount ? (
                  <Link
                    to="/preferences"
                    className="hidden rounded-md px-3 py-2.5 text-sm text-ink-muted hover:text-ink md:inline-block"
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
              className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-soft hover:bg-paper hover:text-ink lg:hidden"
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
