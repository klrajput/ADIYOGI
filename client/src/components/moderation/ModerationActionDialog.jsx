import Button from '../ui/Button';

export const THREAD_ACTIONS = [
  { value: 'hide', label: 'Hide content', destructive: true, help: 'Removes the thread from public view. The audit log records who did it and why.' },
  { value: 'unhide', label: 'Unhide content', destructive: false, help: 'Makes previously hidden content visible again.' },
  { value: 'pin', label: 'Pin thread', destructive: false, help: 'Keeps the thread at the top of its board.' },
  { value: 'unpin', label: 'Unpin thread', destructive: false, help: 'Returns the thread to normal ordering.' },
  { value: 'lock', label: 'Lock thread', destructive: false, help: 'Prevents new replies without hiding existing ones.' },
  { value: 'unlock', label: 'Unlock thread', destructive: false, help: 'Allows replies again.' },
  { value: 'delete', label: 'Delete content', destructive: true, help: 'Soft-deletes the thread. This is the most serious action and is fully audited.' },
];

export const REPLY_ACTIONS = [
  { value: 'hide', label: 'Hide reply', destructive: true, help: 'Removes the reply from public view. The audit log records who did it and why.' },
  { value: 'unhide', label: 'Unhide reply', destructive: false, help: 'Makes a hidden reply visible again.' },
  { value: 'delete', label: 'Delete reply', destructive: true, help: 'Soft-deletes the reply. This is a serious action and is fully audited.' },
];

export function actionsForTarget(targetType) {
  return targetType === 'reply' ? REPLY_ACTIONS : THREAD_ACTIONS;
}

export function actionDefinition(targetType, action) {
  return actionsForTarget(targetType).find((entry) => entry.value === action) || null;
}

/**
 * Accessible confirmation dialog for a moderation action. A reason is required
 * for destructive actions (hide/delete) and is always written to the audit log.
 */
export default function ModerationActionDialog({
  targetType = 'thread',
  targetLabel = '',
  action,
  onActionChange,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
  busy = false,
  error = null,
}) {
  const actions = actionsForTarget(targetType);
  const definition = actionDefinition(targetType, action) || actions[0];
  const destructive = Boolean(definition?.destructive);
  const reasonLength = String(reason || '').trim().length;
  const reasonMissing = destructive && reasonLength < 3;

  return (
    <div>
      <p className="text-sm text-ink-soft">
        Target: <span className="font-semibold text-ink">{targetLabel || 'content'}</span>
      </p>

      <div className="mt-4">
        <label htmlFor="moderation-action" className="label">
          Action
        </label>
        <select
          id="moderation-action"
          className="select min-h-[40px]"
          value={action}
          onChange={(event) => onActionChange(event.target.value)}
          disabled={busy}
        >
          {actions.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
        {definition?.help ? <p className="hint">{definition.help}</p> : null}
      </div>

      <div className="mt-4">
        <label htmlFor="moderation-reason" className="label">
          Reason{' '}
          {destructive ? (
            <span className="text-crisis-600">(required, at least 3 characters)</span>
          ) : (
            <span className="text-ink-muted">(optional)</span>
          )}
        </label>
        <textarea
          id="moderation-reason"
          className={`textarea min-h-[96px] ${
            reasonMissing ? 'border-crisis-400 focus:border-crisis-500' : ''
          }`}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="State the guideline that was broken, or the context a future moderator will need."
          aria-describedby="moderation-reason-hint"
          disabled={busy}
        />
        <p id="moderation-reason-hint" className="hint">
          This note is stored in the audit log with your moderator account. Write facts, not
          judgements about the person.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-crisis-200 bg-crisis-50 px-3 py-2 text-sm text-crisis-700">
          {error.message || 'The action could not be completed. Please try again.'}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={destructive ? 'crisis' : 'primary'} onClick={onConfirm} loading={busy} disabled={reasonMissing}>
          {destructive ? 'Confirm and record' : 'Apply action'}
        </Button>
      </div>
    </div>
  );
}
