import { Icon } from '../common/Icons';
import { THREAD_SORTS } from '../../lib/constants';
import { classNames } from '../../lib/format';

/**
 * Board thread controls: debounced search (the page debounces), sort select and
 * tag filter chips. Everything here is keyboard operable and labelled.
 */
export default function ThreadFilters({
  q,
  onQChange,
  sort,
  onSortChange,
  tags = [],
  activeTag = '',
  onTagChange,
  loading = false,
  className,
}) {
  return (
    <section className={classNames('card p-4 sm:p-5', className)} aria-label="Filter threads">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="thread-search" className="label">
            Search this board
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="thread-search"
              type="search"
              className="input pl-9"
              placeholder="Search titles and posts"
              value={q}
              onChange={(event) => onQChange(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="sm:w-52">
          <label htmlFor="thread-sort" className="label">
            Sort by
          </label>
          <select
            id="thread-sort"
            className="select"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
          >
            {THREAD_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span id="tag-filter-label" className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Tags
          </span>
          <div role="group" aria-labelledby="tag-filter-label" className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTagChange('')}
              aria-pressed={!activeTag}
              className={classNames(
                'chip min-h-[32px] [@media(pointer:coarse)]:min-h-[2.5rem]',
                !activeTag && 'border-primary-300 bg-primary-50 font-medium text-primary-800'
              )}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagChange(activeTag === tag ? '' : tag)}
                aria-pressed={activeTag === tag}
                className={classNames(
                  'chip min-h-[32px] [@media(pointer:coarse)]:min-h-[2.5rem]',
                  activeTag === tag && 'border-primary-300 bg-primary-50 font-medium text-primary-800'
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="sr-only" role="status">
          Updating threads
        </p>
      ) : null}
    </section>
  );
}
