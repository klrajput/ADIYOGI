import Button from '../ui/Button';
import { Icon } from '../common/Icons';
import { classNames } from '../../lib/format';

/**
 * Calm, non-blocking support suggestion shown when an automated crisis
 * assessment returns `elevated` or `high` (draft text or a creation response).
 * It never blocks writing, never labels the person and is explicit that it is
 * not a diagnosis.
 */
export default function SupportCard({ level, onDismiss, className }) {
  if (level !== 'elevated' && level !== 'high') return null;
  const high = level === 'high';

  return (
    <section
      role="status"
      aria-live="polite"
      className={classNames(
        'rounded-lg border p-4 sm:p-5',
        high ? 'border-crisis-300 bg-crisis-50' : 'border-accent-200 bg-accent-50',
        className
      )}
    >
      <p className={classNames('flex items-center gap-2 font-medium', high ? 'text-crisis-700' : 'text-accent-800')}>
        <Icon name="heart" className="h-4 w-4" />
        {high ? 'Support is close by if you want it' : 'It sounds like things may be heavy right now'}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        You can keep writing — nothing here is blocked. If you would like to talk to someone now, verified crisis lines
        and text services are a click away.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        This is an automated support suggestion, not a diagnosis. AdiYogi cannot monitor this page in real time.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button to="/crisis" size="sm" variant={high ? 'crisis' : 'secondary'}>
          {high ? 'Get help now' : 'Find support'}
        </Button>
        {onDismiss ? (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Keep writing
          </Button>
        ) : null}
      </div>
    </section>
  );
}
