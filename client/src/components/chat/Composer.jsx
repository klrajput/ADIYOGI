import { useId } from 'react';

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Chat composer. Enter sends, Shift+Enter inserts a newline, the send button is
 * disabled while empty/over-limit/sending, and the remaining-character count is
 * always visible (and announced to assistive technology when it gets low).
 */
export default function Composer({
  value,
  onChange,
  onSubmit,
  sending = false,
  disabled = false,
  placeholder = 'Write what is on your mind…',
  textareaRef,
}) {
  const id = useId();
  const counterId = `${id}-counter`;
  const hintId = `${id}-hint`;
  const trimmed = value.trim();
  const overLimit = value.length > MAX_MESSAGE_LENGTH;
  const canSend = Boolean(trimmed) && !overLimit && !sending && !disabled;
  const remaining = MAX_MESSAGE_LENGTH - value.length;

  const submit = () => {
    if (!canSend) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      className="border-t border-line bg-surface px-3 py-3 sm:px-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Message to the AI companion
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={id}
          ref={textareaRef}
          className="textarea max-h-40 min-h-[48px] flex-1 resize-y py-2.5"
          value={value}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-describedby={`${counterId} ${hintId}`}
          aria-invalid={overLimit || undefined}
        />
        <button
          type="submit"
          className="btn-primary min-h-[48px] shrink-0 px-4"
          disabled={!canSend}
          aria-label={sending ? 'Sending message' : 'Send message'}
        >
          {sending ? <span className="spinner" aria-hidden="true" /> : null}
          <span>{sending ? 'Sending' : 'Send'}</span>
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-ink-muted">
        <p id={hintId}>
          Enter sends · Shift+Enter adds a line. This chat is not monitored by a human.
        </p>
        <p
          id={counterId}
          className={remaining < 0 ? 'font-semibold text-crisis-600' : remaining <= 100 ? 'text-accent-700' : ''}
        >
          {value.length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>
    </form>
  );
}
