import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from '../common/Logo';
import { Icon } from '../common/Icons';
import Button from '../ui/Button';
import { useIdentity } from '../../context/IdentityContext';
import { PEER_SUPPORT_DISCLAIMER } from '../../lib/constants';
import { classNames, initials } from '../../lib/format';
import { CRISIS_NAV, PRIMARY_NAV } from './navigation';
import { WELLNESS_CATEGORIES } from '../../data/wellnessCategories';

const FOCUSABLE = 'a[href], button:not([disabled])';

function drawerLinkClass({ isActive }) {
  return classNames(
    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
    isActive ? 'bg-primary-50 text-primary-800' : 'text-ink-soft hover:bg-paper hover:text-ink'
  );
}

/**
 * Accessible mobile navigation drawer: Escape closes, focus is trapped inside
 * while open and returned to the trigger on close, background scroll is locked,
 * and the backdrop is dismissible.
 */
export default function MobileNav({ open, onClose }) {
  const panelRef = useRef(null);
  const { identity, loading, refresh, isModerator } = useIdentity();
  const { pathname } = useLocation();

  // Close on navigation so the drawer never covers the destination page.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    first?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = panel?.querySelectorAll(FOCUSABLE);
      if (!focusables || focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      } else if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const alias = identity?.preferences?.displayAlias || identity?.alias || '';

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-cosmic-deep/55 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className="absolute inset-y-0 right-0 flex w-80 max-w-[88vw] flex-col overflow-y-auto border-l border-accent-200/30 bg-surface/95 shadow-lift backdrop-blur-xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Logo />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-soft hover:bg-paper"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>

        <nav aria-label="Primary mobile" className="flex flex-col gap-0.5 px-3 py-4">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={drawerLinkClass} onClick={onClose}>
              <Icon name={item.icon} className="h-5 w-5 text-ink-muted" />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to={CRISIS_NAV.to}
            className={({ isActive }) =>
              classNames(
                'mt-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold',
                isActive ? 'bg-crisis-100 text-crisis-700' : 'bg-crisis-50 text-crisis-600'
              )
            }
            onClick={onClose}
          >
            <Icon name={CRISIS_NAV.icon} className="h-5 w-5" />
            {CRISIS_NAV.label}
          </NavLink>
        </nav>

        <div className="border-t border-line px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Wellness spaces
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {WELLNESS_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                to={`/boards/${encodeURIComponent(category.boardSlug)}`}
                onClick={onClose}
                className="rounded-lg border border-line bg-paper/70 px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-accent-200 hover:text-primary-800"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t border-line px-3 py-4">
          {loading ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ) : identity ? (
            <>
              <div className="mb-2 flex items-center gap-2 px-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800"
                >
                  {initials(alias) || <Icon name="user" className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{alias || 'Anonymous'}</p>
                  <p className="text-xs text-ink-muted">
                    {identity.kind === 'anonymous' ? 'Anonymous session' : 'Signed-in account'}
                  </p>
                </div>
              </div>
              <Link to="/notifications" className={drawerLinkClass} onClick={onClose}>
                <Icon name="bell" className="h-5 w-5 text-ink-muted" />
                Notifications
              </Link>
              <Link to="/preferences" className={drawerLinkClass} onClick={onClose}>
                <Icon name="user" className="h-5 w-5 text-ink-muted" />
                Preferences
              </Link>
              {isModerator ? (
                <Link to="/moderation" className={drawerLinkClass} onClick={onClose}>
                  <Icon name="shield" className="h-5 w-5 text-ink-muted" />
                  Moderation
                </Link>
              ) : null}
              {identity.kind === 'anonymous' ? (
                <Link to="/login" state={{ from: pathname }} className={drawerLinkClass} onClick={onClose}>
                  <Icon name="lock" className="h-5 w-5 text-ink-muted" />
                  Sign in
                </Link>
              ) : null}
            </>
          ) : (
            <div className="px-3">
              <p className="text-sm text-ink-muted">We could not restore your session.</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => refresh()}>
                Try again
              </Button>
            </div>
          )}
        </div>

        <div className="mt-auto space-y-3 border-t border-line px-4 py-4">
          <div className="rounded-lg border border-crisis-200 bg-crisis-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-crisis-700">
              <Icon name="heart" className="h-4 w-4" />
              Need support now?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-crisis-700/90">
              Verified crisis lines and text services are available any time.
            </p>
            <Button to="/crisis" variant="crisis" size="sm" className="mt-3" onClick={onClose}>
              Open crisis support
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
