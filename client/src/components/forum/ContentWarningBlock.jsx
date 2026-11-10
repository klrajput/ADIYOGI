import { useState } from 'react';
import Button from '../ui/Button';
import { Icon } from '../common/Icons';
import { CONTENT_WARNING_LABEL } from '../../lib/constants';

/**
 * Content-warning gate: content is rendered blurred and inert until the reader
 * chooses to reveal it. Not a modal — nothing is blocked, and the page stays
 * scrollable.
 */
export default function ContentWarningBlock({ children, label = CONTENT_WARNING_LABEL, preview, className = '' }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`surface-muted p-5 ${className}`}>
      <p className="eyebrow flex items-center gap-2 text-crisis-600">
        <Icon name="warning" className="h-4 w-4" />
        Content warning
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{label}</p>
      <div
        aria-hidden="true"
        className="relative mt-4 max-h-32 overflow-hidden rounded-md border border-line bg-paper p-4 blur-sm select-none"
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">{preview}</p>
        <div className="pointer-events-none absolute inset-0" />
      </div>
      <Button variant="secondary" className="mt-4" onClick={() => setRevealed(true)}>
        Show content
      </Button>
    </div>
  );
}
