/**
 * Small labelled figure. `value` must be real data from the API; unknown values
 * are passed as `null` and render as a dash rather than a fabricated zero.
 */
export default function Stat({ label, value, hint, className = '' }) {
  const display = value === null || value === undefined || value === '' ? '—' : value;
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="mt-1 font-serif text-2xl leading-none text-ink">{display}</dd>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
