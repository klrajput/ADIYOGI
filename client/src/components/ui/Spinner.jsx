import { classNames } from '../../lib/format';

export default function Spinner({ label = 'Loading', className }) {
  return (
    <span role="status" className={classNames('inline-flex items-center gap-2 text-sm text-ink-muted', className)}>
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = 'Loading…', rows = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card px-5 py-4">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton mt-3 h-3 w-full" />
          <div className="skeleton mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function SpinnerOverlay({ label = 'Working…' }) {
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner label={label} />
    </div>
  );
}
