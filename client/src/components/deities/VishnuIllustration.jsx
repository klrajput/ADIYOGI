/**
 * Original stylised SVG illustration of Lord Vishnu — balance, preservation, protection.
 * Cosmic ocean, four attributes (shankha, chakra, gada, padma), blue/gold palette.
 * Decorative by default.
 */
export default function VishnuIllustration({ className = '', title, animated = true }) {
  const a = (name) => (animated ? name : '');
  return (
    <svg
      viewBox="0 0 420 520"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title || undefined}
      className={className}
      fill="none"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <radialGradient id="vishnu-glow" cx="50%" cy="36%" r="58%">
          <stop offset="0%" stopColor="#D8E1EC" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#2F4C6E" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0B1A27" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vishnu-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B0D2E6" />
          <stop offset="55%" stopColor="#6FA3C7" />
          <stop offset="100%" stopColor="#2F5878" />
        </linearGradient>
        <linearGradient id="vishnu-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5E8CB" />
          <stop offset="50%" stopColor="#B88A42" />
          <stop offset="100%" stopColor="#7E5B28" />
        </linearGradient>
        <linearGradient id="vishnu-silk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5E8CB" />
          <stop offset="100%" stopColor="#C99E55" />
        </linearGradient>
        <linearGradient id="vishnu-ocean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F3A57" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0B1A27" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* celestial glow + stars */}
      <circle cx="210" cy="200" r="196" fill="url(#vishnu-glow)" className={a('animate-aura-pulse')} />
      <g fill="#F5E8CB">
        {[
          [64, 96, 1.5, 0],
          [126, 64, 1, 1.4],
          [298, 78, 1.6, 2.2],
          [352, 148, 1.1, 0.8],
          [46, 210, 1.3, 3.4],
          [372, 250, 1.2, 2.8],
          [92, 300, 1, 4.2],
          [320, 330, 1.4, 1.8],
        ].map(([x, y, r, delay], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity="0.8" style={{ animationDelay: `${delay}s` }} className={a('animate-twinkle')} />
        ))}
      </g>

      {/* rotating chakra behind the figure */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className={a('animate-spin-slow')} opacity="0.75">
        <circle cx="210" cy="196" r="152" stroke="#B88A42" strokeWidth="1.1" strokeDasharray="3 9" />
      </g>

      {/* cosmic ocean */}
      <g>
        <path d="M0 430 C60 414 120 444 180 430 C240 416 300 446 360 430 C390 422 408 430 420 434 V520 H0 Z" fill="url(#vishnu-ocean)" />
        <g className={a('animate-wave-slide')} style={{ width: '200%' }}>
          <path d="M0 456 C40 446 80 466 120 456 C160 446 200 466 240 456 C280 446 320 466 360 456 C400 446 420 460 440 456 V520 H0 Z" fill="#142D46" opacity="0.85" />
          <path d="M-420 456 C-380 446 -340 466 -300 456 C-260 446 -220 466 -180 456 C-140 446 -100 466 -60 456 C-20 446 0 460 20 456 V520 H-420 Z" fill="#142D46" opacity="0.85" />
        </g>
        <path d="M0 484 C60 472 120 496 180 484 C240 472 300 498 360 484 C390 477 408 484 420 488 V520 H0 Z" fill="#0B1A27" opacity="0.9" />
      </g>

      {/* figure */}
      <g className={a('animate-float-slow')} style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}>
        {/* four arms — rear pair raised with attributes */}
        <path d="M182 244 C158 226 140 200 136 172" stroke="url(#vishnu-skin)" strokeWidth="11" strokeLinecap="round" />
        <path d="M238 244 C262 226 280 200 284 172" stroke="url(#vishnu-skin)" strokeWidth="11" strokeLinecap="round" />
        {/* shankha (conch) — upper left */}
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className={a('animate-float')}>
          <path d="M136 172 C124 158 128 140 142 132 C154 126 166 134 166 146 C166 158 156 166 148 168 C144 160 146 152 152 148 C148 146 140 150 138 158 Z" fill="#F5E8CB" opacity="0.95" />
          <circle cx="142" cy="150" r="3" fill="#B88A42" />
        </g>
        {/* chakra (discus) — upper right */}
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className={a('animate-spin-slow')}>
          <circle cx="284" cy="150" r="19" stroke="url(#vishnu-gold)" strokeWidth="3" />
          <circle cx="284" cy="150" r="7" fill="url(#vishnu-gold)" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * Math.PI * 2) / 8;
            return (
              <line
                key={i}
                x1={284 + Math.cos(angle) * 7}
                y1={150 + Math.sin(angle) * 7}
                x2={284 + Math.cos(angle) * 19}
                y2={150 + Math.sin(angle) * 19}
                stroke="url(#vishnu-gold)"
                strokeWidth="1.6"
              />
            );
          })}
        </g>

        {/* torso */}
        <path d="M210 216 C238 216 254 234 256 264 C258 300 252 330 246 352 L174 352 C168 330 162 300 164 264 C166 234 182 216 210 216 Z" fill="url(#vishnu-skin)" />
        <path d="M210 224 C226 228 238 242 240 264 C241 290 238 320 234 342 L186 342 C182 320 179 290 180 264 C182 242 194 228 210 224 Z" fill="#2F5878" opacity="0.28" />

        {/* yellow silk garment */}
        <path d="M174 336 C190 348 230 348 246 336 L252 392 C238 404 182 404 168 392 Z" fill="url(#vishnu-silk)" />
        <path d="M180 360 C200 372 220 372 242 360" stroke="#9C7233" strokeWidth="1.4" opacity="0.55" />
        <path d="M210 344 v52" stroke="#9C7233" strokeWidth="1.2" opacity="0.4" />
        {/* lotus base */}
        <g fill="#D9D5E8" opacity="0.9">
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={176 + i * 17} cy={404 + (i % 2) * 4} rx="14" ry="6" />
          ))}
        </g>

        {/* forearms — right holds gada, left holds padma */}
        <path d="M176 250 C158 270 152 296 156 318" stroke="url(#vishnu-skin)" strokeWidth="12" strokeLinecap="round" />
        <path d="M244 250 C266 266 274 288 272 310" stroke="url(#vishnu-skin)" strokeWidth="12" strokeLinecap="round" />

        {/* gada (mace) */}
        <g className={a('animate-sway')} style={{ transformBox: 'fill-box', transformOrigin: 'top center' }}>
          <rect x="271" y="196" width="3" height="34" rx="1.5" fill="url(#vishnu-gold)" />
          <ellipse cx="272.5" cy="188" rx="10" ry="12" fill="url(#vishnu-gold)" />
          <path d="M264 184 q8.5 -6 17 0" stroke="#7E5B28" strokeWidth="1.2" opacity="0.6" />
        </g>
        {/* padma (lotus) */}
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className={a('animate-float')}>
          {Array.from({ length: 5 }).map((_, i) => {
            const angle = -70 + i * 35;
            return (
              <ellipse
                key={i}
                cx={156 + Math.cos((angle * Math.PI) / 180) * 12}
                cy={320 + Math.sin((angle * Math.PI) / 180) * 10}
                rx="9"
                ry="4"
                fill="#EAD3A2"
                opacity={0.65 + i * 0.06}
                transform={`rotate(${angle} ${156} ${320})`}
              />
            );
          })}
          <circle cx="156" cy="322" r="3.6" fill="#B88A42" />
        </g>

        {/* neck + head */}
        <rect x="203" y="204" width="14" height="16" rx="6" fill="#4A7FA6" />
        <ellipse cx="210" cy="184" rx="31" ry="36" fill="url(#vishnu-skin)" />
        {/* kirita crown */}
        <path d="M181 158 C181 132 196 118 210 112 C224 118 239 132 239 158 C228 148 192 148 181 158 Z" fill="url(#vishnu-gold)" />
        <path d="M210 108 l5 12 7 -7 2 14 -14 2 -14 -2 2 -14 7 7 Z" fill="url(#vishnu-gold)" />
        <circle cx="210" cy="130" r="3.2" fill="#F5E8CB" />
        {/* serene face */}
        <g stroke="#0C2620" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
          <path d="M196 182 q6.5 -5 13 0" />
          <path d="M211 182 q6.5 -5 13 0" />
        </g>
        <path d="M210 188 v8" stroke="#2C4F46" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        <path d="M204 198 q6 3.6 12 0" stroke="#0C2620" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        <path d="M210 172 v-6" stroke="#B88A42" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="181" cy="190" r="3.8" fill="none" stroke="#B88A42" strokeWidth="1.6" />
        <circle cx="239" cy="190" r="3.8" fill="none" stroke="#B88A42" strokeWidth="1.6" />
        {/* vanamala garland */}
        <path d="M186 236 C196 258 224 258 234 236" stroke="#A8BFA8" strokeWidth="2.6" strokeLinecap="round" opacity="0.8" />
        <circle cx="210" cy="252" r="3" fill="#A8BFA8" opacity="0.9" />
      </g>

      {/* blossoms on the water */}
      <g fill="#D9D5E8" opacity="0.85">
        {[
          [70, 470, 0],
          [348, 462, 2],
          [120, 492, 3.4],
        ].map(([x, y, delay], i) => (
          <ellipse key={i} cx={x} cy={y} rx="5" ry="2.4" style={{ animationDelay: `${delay}s` }} className={a('animate-float')} />
        ))}
      </g>
    </svg>
  );
}
