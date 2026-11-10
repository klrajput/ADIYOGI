import { Link } from 'react-router-dom';
import { formatDateTime, timeAgo } from '../../lib/format';
import Pagination from '../ui/Pagination';
import { actionLabel, formatReason, threadIdFor } from './targets';

function SkeletonRow() {
  return (
    <li className="px-4 py-3">
      <div className="skeleton h-3.5 w-1/3" />
      <div className="skeleton mt-2 h-3 w-2/3" />
    </li>
  );
}

/**
 * Moderation audit log. Every moderation action is listed with who did it, what
 * it targeted and why — the accountability surface for the moderation team.
 */
export default function AuditLog({ entries = [], loading = false, error = null, meta = null, onPageChange, onRetry }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-serif text-lg text-ink">Audit log</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Every action is recorded with the moderator, the target and the reason.
          </p>
        </div>
        {error ? (
          <button type="button" className="btn-secondary btn-sm min-h-[40px]" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>

      {loading ? (
        <ul className="divide-y divide-line">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      ) : null}

      {!loading && error ? (
        <div role="alert" className="px-4 py-6 text-center">
          <p className="text-sm text-crisis-700">The audit log could not be loaded.</p>
          <p className="mt-1 text-xs text-ink-muted">
            {error.message || 'This was a loading problem — the moderation history is still stored.'}
          </p>
        </div>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-ink">No moderation actions yet</p>
          <p className="mt-1 text-xs text-ink-muted">
            Actions taken from the queue will appear here with their reasons.
          </p>
        </div>
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <ul className="divide-y divide-line">
          {entries.map((entry) => {
            const threadId = threadIdFor(entry.targetType, entry.targetId, null);
            return (
              <li
                key={entry.id || `${entry.action || 'action'}-${entry.createdAt || entry.targetId}`}
                className="px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{actionLabel(entry.action)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {entry.targetType === 'reply' ? 'Reply' : 'Thread'}{' '}
                      {threadId ? (
                        <Link to={`/threads/${threadId}`} className="link">
                          {entry.targetId}
                        </Link>
                      ) : (
                        entry.targetId
                      )}
                      {entry.moderator?.displayName ? ` · by ${entry.moderator.displayName}` : ''}
                    </p>
                  </div>
                  <time
                    dateTime={entry.createdAt || undefined}
                    className="shrink-0 text-xs text-ink-muted"
                    title={entry.createdAt ? formatDateTime(entry.createdAt) : undefined}
                  >
                    {timeAgo(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-1 break-words text-sm text-ink-soft">
                  {entry.reason ? formatReason(entry.reason) : 'No reason recorded.'}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {meta && meta.totalPages > 1 ? (
        <div className="border-t border-line px-4 py-3">
          <Pagination meta={meta} onPageChange={onPageChange} label="audit log pages" />
        </div>
      ) : null}
    </div>
  );
}
