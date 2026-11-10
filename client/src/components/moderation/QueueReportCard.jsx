import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { formatDateTime, timeAgo } from '../../lib/format';
import { formatReason, STATUS_TONES, statusLabel, threadIdFor } from './targets';

/**
 * One open/reviewing report in the moderation queue. Shows what was reported,
 * why, how old it is, and gives moderators a link to the underlying thread — the
 * decision itself happens in an accessible dialog.
 */
export default function QueueReportCard({ report, onOpenAction, onResolve }) {
  const threadId = threadIdFor(report.targetType, report.targetId, report.targetThread);
  const targetLabel =
    report.targetType === 'reply'
      ? `Reply ${report.targetId}`
      : threadId
        ? `Thread ${threadId}`
        : 'Content';

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[report.status] || 'neutral'}>{statusLabel(report.status)}</Badge>
            <Badge tone="neutral">{report.targetType === 'reply' ? 'Reply' : 'Thread'}</Badge>
            <span className="text-xs text-ink-muted">
              <time dateTime={report.createdAt || undefined}>{timeAgo(report.createdAt)}</time>
              {report.createdAt ? (
                <span className="sr-only"> ({formatDateTime(report.createdAt)})</span>
              ) : null}
            </span>
          </div>
          <h3 className="mt-2 font-serif text-base text-ink">{formatReason(report.reason)}</h3>
          {report.details ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
              {report.details}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">No additional details were provided.</p>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            {threadId ? (
              <Link to={`/threads/${threadId}`} className="link">
                Open the underlying thread →
              </Link>
            ) : (
              <span>No linked thread is available for this report.</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          className="btn-secondary btn-sm min-h-[40px]"
          onClick={() =>
            onOpenAction({
              action: 'hide',
              targetType: report.targetType,
              targetId: report.targetId,
              reportId: report.id,
              targetLabel,
            })
          }
        >
          Moderate content
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm min-h-[40px]"
          onClick={() => onResolve(report, 'resolved')}
        >
          Mark resolved
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm min-h-[40px]"
          onClick={() => onResolve(report, 'dismissed')}
        >
          Dismiss report
        </button>
      </div>
    </li>
  );
}
