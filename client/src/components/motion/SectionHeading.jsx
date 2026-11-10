import { classNames } from '../../lib/format';
import Reveal from './Reveal';

/**
 * Consistent section header: gold eyebrow, serif title, supporting copy.
 * `light` renders on cosmic backgrounds.
 */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  light = false,
  action,
  className,
  titleId,
}) {
  return (
    <Reveal
      className={classNames(
        'flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className
      )}
    >
      <div className={classNames('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow ? <p className="eyebrow-divine">{eyebrow}</p> : null}
        <h2 id={titleId} className={classNames('mt-3', light ? 'section-heading-light' : 'section-heading')}>
          {title}
        </h2>
        {description ? (
          <p className={classNames('mt-4 text-[15px] leading-relaxed sm:text-base', light ? 'text-paper/75' : 'text-ink-muted')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Reveal>
  );
}
