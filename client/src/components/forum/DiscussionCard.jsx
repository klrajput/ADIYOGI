import { Link } from 'react-router-dom';
import { Icon } from '../common/Icons';
import { categoryForBoard } from '../../data/wellnessCategories';
import { classNames, formatCount, humanizeSlug, initials, timeAgo } from '../../lib/format';

/**
 * Modern discussion card used on the community dashboard and the landing page.
 *
 * Layout rules that fix the old cards: the text column is a `min-w-0` flex child so
 * titles and excerpts wrap instead of overflowing, single words never split
 * (global `overflow-wrap: break-word`, no `break-all`), and metadata is a wrapping
 * flex row so nothing is clipped at narrow widths.
 */
export default function DiscussionCard({ thread, showBoard = true, className }) {
  const category = showBoard ? categoryForBoard(thread.boardSlug) : null;
  const categoryLabel = category?.name || thread.boardName || humanizeSlug(thread.boardSlug);
  const initialsValue = initials(thread.authorAlias || 'Anon');
  const replies = Number.isFinite(thread.replyCount) ? thread.replyCount : null;
  const views = formatCount(thread.viewCount);

  return (
    <article
      className={classNames(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition-all duration-300 ease-calm hover:-translate-y-1 hover:border-accent-200 hover:shadow-lift',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-800 text-xs font-semibold text-surface"
        >
          {initialsValue || '·'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{thread.authorAlias || 'Anonymous'}</p>
          <p className="truncate text-xs text-ink-faint">
            {timeAgo(thread.lastActivityAt || thread.createdAt)}
            {categoryLabel ? <span aria-hidden="true"> · </span> : null}
            {categoryLabel ? <span className="text-ink-muted">{categoryLabel}</span> : null}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-700">
          {categoryLabel}
        </span>
      </div>

      <h3 className="mt-3.5 line-clamp-2 font-serif text-lg leading-snug text-ink transition-colors group-hover:text-primary-800 [text-wrap:balance]">
        <Link to={`/threads/${encodeURIComponent(thread.id)}`} className="after:absolute after:inset-0 after:content-['']">
          {thread.title}
        </Link>
      </h3>

      {thread.contentWarning ? (
        <p className="mt-2 text-sm italic leading-relaxed text-ink-muted">
          Opens with a content warning you can choose to reveal.
        </p>
      ) : (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{thread.excerpt}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-ink-muted">
        {replies !== null ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="message" className="h-3.5 w-3.5" />
            {replies === 1 ? '1 reply' : `${replies} replies`}
          </span>
        ) : null}
        {views && views !== '0' ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="eye" className="h-3.5 w-3.5" />
            {views} views
          </span>
        ) : null}
        {thread.isPinned ? (
          <span className="inline-flex items-center gap-1 text-accent-600">
            <Icon name="shield" className="h-3.5 w-3.5" />
            Pinned
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary-700 opacity-0 transition-opacity group-hover:opacity-100">
          Read
          <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
