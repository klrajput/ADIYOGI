import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { Icon } from '../common/Icons';
import { BOARD_SUPPORT_LEVELS } from '../../lib/constants';
import { classNames, countPhrase } from '../../lib/format';

/**
 * Board directory card. Counts are rendered from real API data; a missing count
 * is omitted and zero is stated honestly ("No threads yet").
 */
export default function BoardCard({ board, className }) {
  const support = BOARD_SUPPORT_LEVELS[board.supportLevel] || BOARD_SUPPORT_LEVELS.general;
  const threads = countPhrase(board.threadCount, 'thread', 'threads', 'No threads yet');
  const replies = countPhrase(board.replyCount, 'reply', 'replies', 'No replies yet');

  return (
    <Link
      to={`/boards/${encodeURIComponent(board.slug)}`}
      className={classNames(
        'card-interactive group flex h-full flex-col p-5 focus-visible:outline-none',
        className
      )}
      aria-label={`Open the ${board.name} board`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-xl"
          >
            {board.icon || <Icon name="community" className="h-5 w-5 text-primary-700" />}
          </span>
          <div className="min-w-0">
            <h3 className="break-words font-serif text-lg leading-snug text-ink">{board.name}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{board.tags.slice(0, 3).join(' · ') || 'Peer space'}</p>
          </div>
        </div>
        <Badge tone={support.tone}>{support.label}</Badge>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-muted">{board.description}</p>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="text-xs text-ink-muted">
          {threads ? <span>{threads}</span> : null}
          {threads && replies ? <span aria-hidden="true"> · </span> : null}
          {replies ? <span>{replies}</span> : null}
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 transition-colors group-hover:text-primary-800">
          Open board
          <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
