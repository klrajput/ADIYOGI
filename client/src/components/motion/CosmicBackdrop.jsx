import { classNames } from '../../lib/format';

/**
 * Layered cosmic backdrop for spiritual sections: gradient sky, nebula haze, star field,
 * optional rotating mandala and a soft horizon. Decorative only (aria-hidden).
 */
export default function CosmicBackdrop({ className, variant = 'default', mandala = true }) {
  return (
    <div aria-hidden="true" className={classNames('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className={classNames(
          'absolute inset-0',
          variant === 'deep' ? 'bg-cosmic-rise' : 'bg-cosmic-soft'
        )}
      />
      <div className="cosmic-haze" />
      <div className="cosmic-stars opacity-80" />
      {mandala ? (
        <svg
          viewBox="0 0 200 200"
          className="absolute left-1/2 top-1/2 h-[54rem] w-[54rem] -translate-x-1/2 -translate-y-1/2 animate-spin-slow opacity-[0.16]"
        >
          <g fill="none" stroke="#EAD3A2" strokeWidth="0.35">
            <circle cx="100" cy="100" r="96" />
            <circle cx="100" cy="100" r="78" strokeDasharray="2 5" />
            <circle cx="100" cy="100" r="58" />
            {Array.from({ length: 24 }).map((_, index) => {
              const angle = (index * Math.PI * 2) / 24;
              return (
                <line
                  key={index}
                  x1={100 + Math.cos(angle) * 58}
                  y1={100 + Math.sin(angle) * 58}
                  x2={100 + Math.cos(angle) * 78}
                  y2={100 + Math.sin(angle) * 78}
                />
              );
            })}
            {Array.from({ length: 12 }).map((_, index) => {
              const angle = (index * Math.PI * 2) / 12;
              return (
                <circle
                  key={`p-${index}`}
                  cx={100 + Math.cos(angle) * 87}
                  cy={100 + Math.sin(angle) * 87}
                  r="1.2"
                  fill="#EAD3A2"
                  stroke="none"
                />
              );
            })}
          </g>
        </svg>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cosmic-deep/90 to-transparent" />
    </div>
  );
}
