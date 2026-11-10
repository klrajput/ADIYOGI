/**
 * Visible + announced "the companion is responding" state. Uses `role="status"`
 * with a polite live region so screen-reader users know the request is in flight.
 */
export default function TypingIndicator({ visible }) {
  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 px-1 py-1">
      <span aria-hidden="true" className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-faint" />
        <span
          className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-faint"
          style={{ animationDelay: '0.18s' }}
        />
        <span
          className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-faint"
          style={{ animationDelay: '0.36s' }}
        />
      </span>
      <span className="text-xs font-medium text-ink-muted">Companion is responding…</span>
    </div>
  );
}
