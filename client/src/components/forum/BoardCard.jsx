import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { Icon } from '../common/Icons';
import CategoryAtmosphere from '../categories/CategoryAtmosphere';
import CategoryGlyph from '../categories/CategoryGlyph';
import { categoryForBoard } from '../../data/wellnessCategories';
import { BOARD_SUPPORT_LEVELS } from '../../lib/constants';
import { classNames, countPhrase } from '../../lib/format';

/**
 * Board directory card. Each board inherits its wellness category's atmosphere so the
 * directory never looks like a wall of identical boxes. Counts are real API data; a
 * missing count is omitted and zero is stated honestly.
 */
export default function BoardCard({ board, className }) {
  const support = BOARD_SUPPORT_LEVELS[board.supportLevel] || BOARD_SUPPORT_LEVELS.general;
  const category = categoryForBoard(board.slug);
  const threads = countPhrase(board.threadCount, 'thread', 'threads', 'No threads yet');
  const replies = countPhrase(board.replyCount, 'reply', 'replies', 'No replies yet');

  return (
    <Link
      to={`/boards/${encodeURIComponent(board.slug)}`}
      className={classNames(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-300 ease-calm hover:-translate-y-1 hover:border-accent-200 hover:shadow-lift focus-visible:outline-none',
        className
      )}
      aria-label={`Open the ${board.name} board`}
    >
      <div className="relative h-20 shrink-0 overflow-hidden">
        <CategoryAtmosphere atmosphere={category?.atmosphere || 'nature'} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
      </div>

      <div className="relative -mt-8 flex flex-1 flex-col p-5 pt-0">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface/90 text-primary-700 shadow-sm backdrop-blur"
          >
            {board.icon || <CategoryGlyph name={category?.glyph || 'leaf'} className="h-6 w-6" />}
          </span>
          <Badge tone={support.tone}>{support.label}</Badge>
        </div>

        <h3 className="mt-3 break-words font-serif text-lg leading-snug text-ink [text-wrap:balance]">{board.name}</h3>
        <p className="mt-1 truncate text-xs text-ink-faint">
          {board.tags.slice(0, 3).join(' · ') || 'Peer space'}
        </p>

        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{board.description}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="text-xs text-ink-muted">
            {threads ? <span>{threads}</span> : null}
            {threads && replies ? <span aria-hidden="true"> · </span> : null}
            {replies ? <span>{replies}</span> : null}
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 transition-colors group-hover:text-primary-800">
            Open
            <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
