/**
 * Minimal inline SVG icon set.
 *
 * No icon dependency, no emoji-only controls: every icon is decorative
 * (`aria-hidden`) and is paired with a visible label or an accessible name on
 * the interactive element that contains it.
 */
import { classNames } from '../../lib/format';

const PATHS = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.7 1 4.9 1.5 5.5H5c.5-.6 1.5-1.8 1.5-5.5Z" />
      <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  'chevron-right': <path d="M9.5 6l6 6-6 6" />,
  'arrow-right': (
    <>
      <path d="M4.5 12h15" />
      <path d="M13.5 6l6 6-6 6" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M19.5 12h-15" />
      <path d="M10.5 6l-6 6 6 6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.8v5.4c0 3.9-2.9 6.9-7 8.8-4.1-1.9-7-4.9-7-8.8V6.3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  heart: <path d="M12 20.5S4.5 16 4.5 10.5A4 4 0 0 1 12 8a4 4 0 0 1 7.5 2.5C19.5 16 12 20.5 12 20.5Z" />,
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h10.5l-1.8 4 1.8 4H6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4l8.5 15h-17Z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 6.5" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  phone: (
    <path d="M5 4.5h3l1.8 4.4-2 1.3a12.5 12.5 0 0 0 6 6l1.3-2 4.4 1.8v3a1.8 1.8 0 0 1-2 1.8A17 17 0 0 1 3.2 6.5 1.8 1.8 0 0 1 5 4.5Z" />
  ),
  community: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.8a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.2a5.3 5.3 0 0 1 3 4.8" />
    </>
  ),
  message: (
    <path d="M20.5 11.5a8.2 8.2 0 0 1-8.2 8.2H8l-4.5 2.5 1.4-4.2a8.2 8.2 0 0 1 7.4-12 8.2 8.2 0 0 1 8.2 7.5Z" />
  ),
  sparkle: (
    <>
      <path d="M12 3.5l2.1 6.4 6.4 2.1-6.4 2.1L12 20.5l-2.1-6.4L3.5 12l6.4-2.1Z" />
    </>
  ),
  home: (
    <>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1Z" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10 5 7 4.5 4.5 4.5v13c2.5 0 5.5.5 7.5 2 2-1.5 5-2 7.5-2v-13C17 4.5 14 5 12 6.5Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.8h5V7" />
      <path d="M6.5 7l1 13h9l1-13" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6.5 19.5H14" />
      <path d="M17 8.5l3.5 3.5L17 15.5" />
      <path d="M20.5 12H10" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11.4 6.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0L5 12.6a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </>
  ),
};

export function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.6 }) {
  const glyph = PATHS[name];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={classNames('shrink-0', className)}
    >
      {glyph}
    </svg>
  );
}

export default Icon;
