import { classNames } from '../../lib/format';

/** Server-driven pagination controls. Renders nothing when there is one page. */
export default function Pagination({ meta, onPageChange, className, label = 'pages' }) {
  if (!meta || !meta.totalPages || meta.totalPages <= 1) return null;
  const { page, totalPages, hasPrev, hasNext } = meta;

  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let index = start; index <= end; index += 1) pages.push(index);

  return (
    <nav className={classNames('flex flex-wrap items-center justify-between gap-3', className)} aria-label={`Pagination, ${label}`}>
      <p className="text-sm text-ink-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          aria-label="Previous page"
        >
          Previous
        </button>
        {pages.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => onPageChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={classNames(
              'btn-sm min-w-[2.25rem] rounded-md border px-2 py-1 text-xs font-medium',
              entry === page
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-line bg-surface text-ink-muted hover:border-line-strong'
            )}
          >
            {entry}
          </button>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
