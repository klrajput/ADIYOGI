import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { Icon } from '../common/Icons';
import { classNames, countPhrase, formatCount, humanizeSlug, timeAgo, truncate } from '../../lib/format';

/**
 * One row in a thread list. Real metadata only: replies/views are hidden when
 * the API does not provide them. Content-warned threads never leak their
 * excerpt into the list.
 */
export default function ThreadListItem({ thread, showBoard = false, className }) {
  const replies = countPhrase(thread.replyCount, 'reply', 'replies', 'No replies');
  const views = formatCount(thread.viewCount);
  const tags = thread.tags.slice(0, 3);

  return (
    <li className={classNames('border-b border-line last:border-b-0', className)}>
      <Link
        to={`/threads/${encodeURIComponent(thread.id)}`}
        className="group block px-4 py-4 transition-colors hover:bg-paper/70 sm:px-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          {thread.isPinned ? (
            <Badge tone="accent">
              <Icon name="shield" className="h-3 w-3" />
              Pinned
            </Badge>
          ) : null}
          {thread.isLocked ? (
            <Badge tone="neutral">
              <Icon name="lock" className="h-3 w-3" />
              Locked
            </Badge>
          ) : null}
          {thread.contentWarning ? (
            <Badge tone="crisis">
              <Icon name="warning" className="h-3 w-3" />
              Content warning
            </Badge>
          ) : null}
          {showBoard && (thread.boardName || thread.boardSlug) ? (
            <Badge tone="neutral">{thread.boardName || humanizeSlug(thread.boardSlug)}</Badge>
          ) : null}
          <span className="ml-auto text-xs text-ink-muted">{timeAgo(thread.lastActivityAt || thread.createdAt)}</span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 break-words font-serif text-lg leading-snug text-ink transition-colors group-hover:text-primary-800">
          {thread.title}
        </h3>

        {thread.contentWarning ? (
          <p className="mt-1.5 text-sm italic text-ink-muted">Opens with a content warning you can choose to reveal.</p>
        ) : thread.excerpt ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{truncate(thread.excerpt, 200)}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="font-medium text-ink-muted">{thread.authorAlias}</span>
          {replies ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="message" className="h-3.5 w-3.5" />
              {replies}
            </span>
          ) : null}
          {views !== null && views !== '0' ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="eye" className="h-3.5 w-3.5" />
              {views} views
            </span>
          ) : null}
          {tags.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-muted">
                  #{tag}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
