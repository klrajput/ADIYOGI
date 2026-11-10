/** Shared navigation model so the desktop bar and mobile drawer never drift. */
export const PRIMARY_NAV = [
  { to: '/community', label: 'Community', icon: 'community' },
  { to: '/chat', label: 'AI companion', icon: 'sparkle' },
  { to: '/resources', label: 'Resources', icon: 'book' },
  { to: '/guidelines', label: 'Guidelines', icon: 'shield' },
];

/** The crisis affordance is rendered separately: it is always visible. */
export const CRISIS_NAV = { to: '/crisis', label: 'Crisis help', icon: 'heart' };

export default PRIMARY_NAV;
