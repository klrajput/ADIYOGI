import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';

/**
 * Collapsible board guidelines. Uses a native <details>/<summary> pair so it is
 * keyboard operable and discoverable without custom JS.
 */
export default function BoardGuidelines({ guidelines = [], className = '' }) {
  if (!Array.isArray(guidelines) || guidelines.length === 0) return null;

  return (
    <details className={`card group overflow-hidden ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink-soft transition-colors hover:bg-paper/70 sm:px-5">
        <span className="flex items-center gap-2">
          <Icon name="book" className="h-4 w-4 text-ink-muted" />
          Board guidelines
        </span>
        <Icon name="chevron-down" className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4 py-4 sm:px-5">
        <ul className="space-y-2">
          {guidelines.map((guideline) => (
            <li key={guideline} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary-400" />
              <span>{guideline}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          By posting here you agree to the{' '}
          <Link to="/guidelines" className="link">
            community guidelines
          </Link>
          .
        </p>
      </div>
    </details>
  );
}
