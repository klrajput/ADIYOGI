import { classNames } from '../../lib/format';

/**
 * Standard page title block: one <h1> per page, optional breadcrumb slot and
 * right-aligned actions. Pages own their container; this component only lays
 * out the header.
 */
export default function PageHeader({ eyebrow, title, description, actions, breadcrumb, className, children }) {
  return (
    <header className={classNames('mb-6 border-b border-line pb-6 sm:mb-8', className)}>
      {breadcrumb ? <div className="mb-3 text-sm text-ink-muted">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow text-ink-muted">{eyebrow}</p> : null}
          <h1 className="mt-1 font-serif text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted sm:text-base">{description}</p> : null}
          {children}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
