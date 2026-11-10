import Button from '../ui/Button';
import { Icon } from './Icons';

/** Empty state for a filtered/searched list: always offers a way to clear. */
export default function EmptySearch({ title = 'No matches', description, onClear, clearLabel = 'Clear search', className = '' }) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center ${className}`}
    >
      <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink-muted">
        <Icon name="search" className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-serif text-lg text-ink">{title}</h3>
      {description ? <p className="mt-2 max-w-prose text-sm text-ink-muted">{description}</p> : null}
      {onClear ? (
        <div className="mt-5">
          <Button variant="secondary" onClick={onClear}>
            {clearLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
