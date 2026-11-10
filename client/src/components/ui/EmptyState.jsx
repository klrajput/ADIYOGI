import { classNames } from '../../lib/format';

/** Presentational empty state — always pair with a concrete next action. */
export default function EmptyState({ icon = '🕊️', title, description, action, className }) {
  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center',
        className
      )}
    >
      <div aria-hidden="true" className="text-3xl">
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-lg text-ink">{title}</h3>
      {description ? <p className="mt-2 max-w-prose text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
