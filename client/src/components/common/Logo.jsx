import { Link } from 'react-router-dom';
import { classNames } from '../../lib/format';

/**
 * Wordmark + restrained mark (a single quiet lotus/circle figure).
 * Text stays selectable and the link has an accessible name.
 */
export default function Logo({ to = '/', className, showWordmark = true }) {
  return (
    <Link
      to={to}
      aria-label="AdiYogi home"
      className={classNames('inline-flex items-center gap-2.5 rounded-md', className)}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8 text-primary-700" aria-hidden="true" focusable="false">
        <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeOpacity="0.22" />
        <path
          d="M16 5.6c4.1 3.3 6.5 6.9 6.5 10.4S20.1 23 16 26.4C11.9 23 9.5 19.4 9.5 16S11.9 8.9 16 5.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="16" r="2.1" className="fill-accent-500" />
      </svg>
      {showWordmark ? (
        <span className="font-serif text-xl font-semibold tracking-tight text-ink">AdiYogi</span>
      ) : null}
    </Link>
  );
}
