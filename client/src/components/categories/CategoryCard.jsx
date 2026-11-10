import { Link } from 'react-router-dom';
import CategoryAtmosphere from './CategoryAtmosphere';
import CategoryGlyph from './CategoryGlyph';
import { SHLOKA_BY_ID } from '../../data/shlokas';
import { classNames } from '../../lib/format';

/**
 * Wellness category card: its own animated atmosphere, a reflection, and a direct
 * path into the matching peer-support board. Never implies the category is a diagnosis.
 */
export default function CategoryCard({ category, className }) {
  const shloka = SHLOKA_BY_ID[category.shlokaId];

  return (
    <Link
      to={`/boards/${encodeURIComponent(category.boardSlug)}`}
      className={classNames(
        'group relative flex min-h-[16.5rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-300 ease-calm hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none',
        className
      )}
      aria-label={`${category.name} — ${category.tagline}. Open the ${category.boardSlug} community board.`}
    >
      <div className="relative h-28 shrink-0 overflow-hidden">
        <CategoryAtmosphere atmosphere={category.atmosphere} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent" />
        <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-surface/70 bg-surface/80 text-primary-700 backdrop-blur">
          <CategoryGlyph name={category.glyph} className="h-5 w-5" />
        </span>
      </div>

      <div className="relative flex flex-1 flex-col p-5 pt-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-serif text-xl leading-snug text-ink">{category.name}</h3>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-600">
            {category.tagline}
          </span>
        </div>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{category.description}</p>

        {shloka ? (
          <p className="mt-3 line-clamp-1 font-deva text-sm text-primary-700" aria-hidden="true">
            {shloka.sanskrit}
          </p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-primary-700 transition-colors group-hover:text-primary-800">
          Enter this space
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M4 10h11M11 5.5 15.5 10 11 14.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
