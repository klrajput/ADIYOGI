import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { formatDateTime, timeAgo } from '../../lib/format';
import { formatReason, STATUS_TONES, statusLabel } from './targets';

/**
 * Hidden thread or reply in the moderation queue. Gives the moderator the actions
 * that make sense for already-hidden content: restore it (unhide), pin/lock
 * threads, or delete it — each through the confirmation dialog.
 */
export default function HiddenContentCard({ item, targetType, onOpenAction }) {
  const isThread = targetType === 'thread';
  const title = item.title || item.excerpt || `Untitled ${targetType}`;
  const body = item.body || '';
  const author = item.author?.alias;
  const targetLabel = `${isThread ? 'Thread' : 'Reply'}: ${title}`;

  const actions = [
    { action: 'unhide', label: 'Unhide', variant: 'secondary' },
    ...(isThread ? [{ action: item.isPinned ? 'unpin' : 'pin', label: item.isPinned ? 'Unpin' : 'Pin', variant: 'ghost' }] : []),
    ...(isThread ? [{ action: item.isLocked ? 'unlock' : 'lock', label: item.isLocked ? 'Unlock' : 'Lock', variant: 'ghost' }] : []),
    { action: 'delete', label: 'Delete', variant: 'crisis' },
  ];

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONES[item.status] || 'crisis'}>{statusLabel(item.status || 'hidden')}</Badge>
        <Badge tone="neutral">{isThread ? 'Thread' : 'Reply'}</Badge>
        {isThread && item.isPinned ? <Badge tone="primary">Pinned</Badge> : null}
        {isThread && item.isLocked ? <Badge tone="neutral">Locked</Badge> : null}
        <span className="text-xs text-ink-muted">
          <time dateTime={item.createdAt || undefined}>{timeAgo(item.createdAt)}</time>
          {item.createdAt ? <span className="sr-only"> ({formatDateTime(item.createdAt)})</span> : null}
        </span>
      </div>

      <h3 className="mt-2 break-words font-serif text-base text-ink">{title}</h3>
      {body ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
          {body}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink-muted">
        {author ? `Author: ${author}` : 'Author alias not available'}
        {isThread && item.boardSlug ? ` · board: ${item.boardSlug}` : ''}
        {item.moderationReason ? ` · moderation note: ${formatReason(item.moderationReason)}` : ''}
      </p>

      {isThread ? (
        <p className="mt-2 text-xs text-ink-muted">
          <Link to={`/threads/${item.id}`} className="link">
            Open the underlying thread →
          </Link>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {actions.map((entry) => (
          <button
            key={entry.action}
            type="button"
            className={
              entry.variant === 'crisis'
                ? 'btn-crisis btn-sm min-h-[40px]'
                : entry.variant === 'ghost'
                  ? 'btn-ghost btn-sm min-h-[40px]'
                  : 'btn-secondary btn-sm min-h-[40px]'
            }
            onClick={() =>
              onOpenAction({
                action: entry.action,
                targetType,
                targetId: item.id,
                reportId: undefined,
                targetLabel,
              })
            }
          >
            {entry.label}
          </button>
        ))}
      </div>
    </li>
  );
}
