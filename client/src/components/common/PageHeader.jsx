import { classNames } from '../../lib/format';
import CategoryAtmosphere from '../categories/CategoryAtmosphere';

/**
 * Standard page title block: one <h1> per page, optional breadcrumb slot and
 * right-aligned actions. `atmosphere` adds a category-specific animated band so
 * each section of the product keeps its own visual character.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumb,
  className,
  children,
  atmosphere,
}) {
  return (
    <header
      className={classNames(
        'relative mb-8 overflow-hidden rounded-3xl border border-line bg-surface/70 px-6 py-8 shadow-card sm:mb-10 sm:px-8 sm:py-10',
        className
      )}
    >
      {atmosphere ? (
        <>
          <div className="absolute inset-0">
            <CategoryAtmosphere atmosphere={atmosphere} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-surface/95 via-surface/80 to-surface/40" />
        </>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-sage-mist opacity-60" />
      )}
      <div className="relative">
        {breadcrumb ? <div className="mb-3 text-sm text-ink-muted">{breadcrumb}</div> : null}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow-divine">{eyebrow}</p> : null}
            <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl lg:text-[2.6rem]">{title}</h1>
            {description ? (
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted sm:text-base">{description}</p>
            ) : null}
            {children}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
