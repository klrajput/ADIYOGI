import { classNames } from '../../lib/format';

/**
 * One animated, category-specific atmosphere scene. Eight distinct visual languages
 * (water, sunrise, nature, night, river, warm light, mountain, moonlight) built from
 * layered gradients + SVG so each wellness category feels different without shipping
 * images.
 */
export default function CategoryAtmosphere({ atmosphere = 'water', className, animated = true }) {
  const a = (name) => (animated ? name : '');
  const scene = {
    water: (
      <>
        <div className="absolute inset-0 atmo-water" />
        <svg viewBox="0 0 400 160" className="absolute inset-x-0 bottom-0 h-2/3 w-full" preserveAspectRatio="none">
          <g className={a('animate-wave-slide')}>
            {[0, 1].map((layer) => (
              <path
                key={layer}
                d={`M${layer * 400} 96 C${layer * 400 + 50} 84 ${layer * 400 + 100} 108 ${layer * 400 + 150} 96 C${layer * 400 + 200} 84 ${layer * 400 + 250} 108 ${layer * 400 + 300} 96 C${layer * 400 + 350} 84 ${layer * 400 + 380} 100 ${layer * 400 + 400} 96 V160 H${layer * 400} Z`}
                fill="#B0C1D6"
                opacity={layer === 0 ? 0.55 : 0.35}
              />
            ))}
          </g>
        </svg>
        <svg viewBox="0 0 400 160" className="absolute inset-0 h-full w-full">
          {[[90, 54, 3], [300, 74, 2], [200, 40, 2.4]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#EDF1F6" opacity="0.8" className={a('animate-float')} style={{ animationDelay: `${i}s` }} />
          ))}
        </svg>
      </>
    ),
    sunrise: (
      <>
        <div className="absolute inset-0 atmo-sunrise" />
        <div className="absolute left-1/2 top-[58%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#FFF4D6] to-[#E8C795] opacity-90 blur-[1px]" />
        <div className="absolute left-1/2 top-[58%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 animate-aura-pulse rounded-full bg-[radial-gradient(circle,rgba(232,199,149,0.7),transparent_70%)]" />
        <svg viewBox="0 0 400 160" className="absolute inset-x-0 bottom-0 h-1/2 w-full" preserveAspectRatio="none">
          <path d="M0 120 C60 100 110 128 170 116 C230 104 280 132 340 118 C370 111 390 118 400 122 V160 H0 Z" fill="#D6A35D" opacity="0.35" />
          <path d="M0 140 C70 126 120 148 190 138 C260 128 320 150 400 140 V160 H0 Z" fill="#B88A42" opacity="0.3" />
        </svg>
      </>
    ),
    nature: (
      <>
        <div className="absolute inset-0 atmo-nature" />
        <svg viewBox="0 0 400 160" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {Array.from({ length: 14 }).map((_, i) => (
            <path
              key={i}
              d={`M${i * 30 + 10} 160 C${i * 30 + 4} 132 ${i * 30 + 16} 112 ${i * 30 + 8} 92`}
              stroke="#7F9C80"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
              style={{ transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: `${(i % 5) * 0.4}s` }}
              className={a('animate-sway')}
            />
          ))}
          {[[80, 40], [250, 28], [330, 56]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="12" ry="5" fill="#A8BFA8" opacity="0.7" className={a('animate-float')} style={{ animationDelay: `${i * 1.2}s` }} />
          ))}
        </svg>
      </>
    ),
    night: (
      <>
        <div className="absolute inset-0 atmo-night" />
        <div className="cosmic-stars" />
        <svg viewBox="0 0 400 160" className="absolute inset-0 h-full w-full">
          {[[70, 40, 1.2], [140, 26, 1.6], [220, 48, 1], [300, 30, 1.4], [350, 60, 1.1], [180, 70, 0.9]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#F5E8CB" className={a('animate-twinkle')} style={{ animationDelay: `${i * 0.7}s` }} />
          ))}
          <circle cx="330" cy="34" r="13" fill="#EAD3A2" opacity="0.85" />
          <circle cx="336" cy="30" r="12" fill="#142D46" />
        </svg>
      </>
    ),
    river: (
      <>
        <div className="absolute inset-0 atmo-river" />
        <svg viewBox="0 0 400 160" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {[0, 1, 2, 3].map((i) => (
            <ellipse
              key={i}
              cx="200"
              cy={120 + i * 6}
              rx={60 + i * 34}
              ry={8 + i * 3}
              fill="none"
              stroke="#839BB8"
              strokeWidth="1.2"
              opacity="0.5"
              style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${i * 0.8}s` }}
              className={a('animate-ripple')}
            />
          ))}
        </svg>
      </>
    ),
    warm: (
      <>
        <div className="absolute inset-0 atmo-warm" />
        <svg viewBox="0 0 400 160" className="absolute inset-0 h-full w-full">
          {[[80, 60, 16], [200, 40, 10], [310, 70, 22], [140, 100, 8], [260, 110, 14]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="url(#warm-bokeh)" opacity="0.7" className={a('animate-float')} style={{ animationDelay: `${i * 0.9}s` }} />
          ))}
          <defs>
            <radialGradient id="warm-bokeh">
              <stop offset="0%" stopColor="#FFF4D6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#E8C795" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </>
    ),
    mountain: (
      <>
        <div className="absolute inset-0 atmo-mountain" />
        <svg viewBox="0 0 400 160" className="absolute inset-x-0 bottom-0 h-full w-full" preserveAspectRatio="none">
          <path d="M0 120 L70 64 L120 100 L190 44 L250 96 L320 58 L400 116 V160 H0 Z" fill="#A9A2C4" opacity="0.55" />
          <path d="M0 140 L90 92 L160 132 L240 84 L320 128 L400 100 V160 H0 Z" fill="#7F9C80" opacity="0.45" />
          <circle cx="320" cy="42" r="16" fill="#F5E8CB" opacity="0.9" className={a('animate-aura-pulse')} />
        </svg>
      </>
    ),
    moon: (
      <>
        <div className="absolute inset-0 atmo-moon" />
        <div className="cosmic-stars opacity-70" />
        <svg viewBox="0 0 400 160" className="absolute inset-0 h-full w-full">
          <circle cx="128" cy="58" r="26" fill="#ECE9F4" opacity="0.92" />
          <circle cx="140" cy="50" r="24" fill="#2F4C6E" />
          <circle cx="128" cy="58" r="38" fill="none" stroke="#D9D5E8" strokeWidth="0.8" opacity="0.5" className={a('animate-aura-pulse')} />
          <path d="M0 130 C80 118 160 140 240 128 C320 116 370 134 400 128 V160 H0 Z" fill="#142D46" opacity="0.6" />
        </svg>
      </>
    ),
  }[atmosphere] || null;

  return (
    <div aria-hidden="true" className={classNames('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {scene}
    </div>
  );
}
