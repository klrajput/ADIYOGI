import { classNames } from '../../lib/format';

const PARTICLES = [
  { x: 12, y: 18, r: 1.6, d: 0, dur: 7 },
  { x: 24, y: 62, r: 1.1, d: 1.2, dur: 9 },
  { x: 38, y: 30, r: 1.9, d: 2.4, dur: 8 },
  { x: 52, y: 74, r: 1.2, d: 0.6, dur: 10 },
  { x: 64, y: 22, r: 1.5, d: 3.1, dur: 7.5 },
  { x: 76, y: 58, r: 1, d: 1.8, dur: 11 },
  { x: 86, y: 34, r: 1.7, d: 2.9, dur: 8.5 },
  { x: 18, y: 84, r: 1.2, d: 4.2, dur: 9.5 },
  { x: 46, y: 12, r: 1, d: 5, dur: 12 },
  { x: 70, y: 88, r: 1.4, d: 2.2, dur: 8 },
];

/**
 * Decorative divine aura: layered halo rings plus slow drifting particles.
 * Pure SVG/CSS so it costs a fraction of a canvas/WebGL field and never blocks input.
 * Always aria-hidden; the surrounding section carries the real content.
 */
export default function AuraField({ className, tone = 'gold', particles = true, rings = 3 }) {
  const palette = {
    gold: { ring: 'rgba(234,211,162,0.5)', dot: '#EAD3A2', glow: 'rgba(184,138,66,0.32)' },
    blue: { ring: 'rgba(176,193,214,0.5)', dot: '#D8E1EC', glow: 'rgba(47,76,110,0.45)' },
    sage: { ring: 'rgba(168,191,168,0.55)', dot: '#C8D8C7', glow: 'rgba(44,107,92,0.35)' },
  }[tone] || 'gold';

  return (
    <div aria-hidden="true" className={classNames('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className="halo left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 animate-aura-pulse sm:h-[34rem] sm:w-[34rem]"
        style={{ background: `radial-gradient(circle, ${palette.glow} 0%, transparent 68%)` }}
      />
      {Array.from({ length: rings }).map((_, index) => (
        <div
          key={index}
          className="aura-ring left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-breathe"
          style={{
            width: `${18 + index * 9}rem`,
            height: `${18 + index * 9}rem`,
            borderColor: palette.ring,
            animationDelay: `${index * 1.6}s`,
            opacity: 0.55 - index * 0.1,
          }}
        />
      ))}
      {particles ? (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {PARTICLES.map((particle, index) => (
            <circle
              key={index}
              cx={particle.x}
              cy={particle.y}
              r={particle.r / 2}
              fill={palette.dot}
              opacity="0.7"
              className="animate-drift"
              style={{ animationDelay: `${particle.d}s`, animationDuration: `${particle.dur}s` }}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
