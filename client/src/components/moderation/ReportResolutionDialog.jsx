import Button from '../ui/Button';

/**
 * Report resolution dialog body (rendered inside the shared Modal). Resolving and
 * dismissing both support a note, which is stored on the report for the audit
 * trail.
 */
export default function ReportResolutionDialog({
  report,
  status,
  onStatusChange,
  note,
  onNoteChange,
  onClose,
  onConfirm,
  busy = false,
  error = null,
}) {
  return (
    <div>
      <p className="text-sm text-ink-soft">
        Report about{' '}
        <span className="font-semibold text-ink">
          {report?.targetType === 'reply' ? 'a reply' : 'a thread'}
        </span>
        {report?.reason ? ` · ${String(report.reason).replace(/[_-]+/g, ' ')}` : ''}
      </p>

      <div className="mt-4">
        <label htmlFor="resolution-status" className="label">
          Decision
        </label>
        <select
          id="resolution-status"
          className="select min-h-[40px]"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          disabled={busy}
        >
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <p className="hint">
          Choose &quot;resolved&quot; when action was taken, and &quot;dismissed&quot; when the
          report did not require action.
        </p>
      </div>

      <div className="mt-4">
        <label htmlFor="resolution-note" className="label">
          Note <span className="text-ink-muted">(optional)</span>
        </label>
        <textarea
          id="resolution-note"
          className="textarea min-h-[88px]"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="What was decided, and why — useful for the next moderator who sees this."
          disabled={busy}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-crisis-200 bg-crisis-50 px-3 py-2 text-sm text-crisis-700">
          {error.message || 'The report could not be updated. Please try again.'}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={busy}>
          Save decision
        </Button>
      </div>
    </div>
  );
}
