import { classNames } from '../../lib/format';

/**
 * Elegant shloka card: Devanagari text, transliteration, English meaning and the
 * authentic scripture reference. `tone` switches between ivory and cosmic surfaces.
 * Wisdom is for reflection; a note can make the "not a substitute for care" boundary
 * explicit wherever it appears next to wellness content.
 */
export default function ShlokaCard({
  shloka,
  tone = 'ivory',
  note,
  compact = false,
  className,
  showTransliteration = true,
}) {
  const dark = tone === 'cosmic';
  return (
    <figure
      className={classNames(
        dark ? 'shloka-card-dark' : 'shloka-card',
        compact ? 'p-5 sm:p-6' : '',
        className
      )}
    >
      <span aria-hidden="true" className={classNames('shloka-om', dark ? 'text-accent-200' : 'text-primary-700')}>
        ॐ
      </span>
      <div className="relative">
        <figcaption className="flex flex-wrap items-center gap-2">
          <span className={classNames('badge-divine', dark && 'border-accent-200/40 bg-accent-200/10 !text-accent-200')}>
            {shloka.topic}
          </span>
          <span className={classNames('text-[11px] uppercase tracking-[0.16em]', dark ? 'text-paper/55' : 'text-ink-faint')}>
            {shloka.source}
          </span>
        </figcaption>

        <blockquote
          className={classNames(
            'shloka-devanagari mt-4 text-balance',
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-[1.75rem]',
            dark ? 'text-paper' : 'text-ink'
          )}
          lang="sa"
        >
          {shloka.sanskrit}
        </blockquote>

        {showTransliteration && shloka.transliteration ? (
          <p className={classNames('mt-2 text-[13px] italic', dark ? 'text-paper/55' : 'text-ink-faint')}>
            {shloka.transliteration}
          </p>
        ) : null}

        <p className={classNames('mt-4 text-sm leading-relaxed', dark ? 'text-paper/85' : 'text-ink-soft')}>
          {shloka.meaning}
        </p>

        {shloka.reflection ? (
          <p className={classNames('mt-3 text-sm leading-relaxed', dark ? 'text-paper/65' : 'text-ink-muted')}>
            {shloka.reflection}
          </p>
        ) : null}

        {note ? (
          <p className={classNames('mt-5 border-t pt-3 text-[11px] leading-relaxed', dark ? 'border-paper/15 text-paper/50' : 'border-line text-ink-faint')}>
            {note}
          </p>
        ) : null}
      </div>
    </figure>
  );
}
