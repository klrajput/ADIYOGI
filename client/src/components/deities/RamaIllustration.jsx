/**
 * Original stylised SVG illustration of Lord Rama — courage, discipline, dharma.
 * Abstract forest light, bow and arrow, blue/gold palette. Decorative by default.
 */
export default function RamaIllustration({ className = '', title, animated = true }) {
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
        <radialGradient id="rama-sun" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#F5E8CB" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#D6A35D" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#A8BFA8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rama-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A9CFE4" />
          <stop offset="60%" stopColor="#6FA3C7" />
          <stop offset="100%" stopColor="#3E6E93" />
        </linearGradient>
        <linearGradient id="rama-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5E8CB" />
          <stop offset="50%" stopColor="#B88A42" />
          <stop offset="100%" stopColor="#7E5B28" />
        </linearGradient>
        <linearGradient id="rama-silk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8C795" />
          <stop offset="100%" stopColor="#B88A42" />
        </linearGradient>
        <linearGradient id="rama-forest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8BFA8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#173F38" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* sun / aura */}
      <circle cx="210" cy="196" r="190" fill="url(#rama-sun)" className={a('animate-aura-pulse')} />
      <g opacity="0.5" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className={a('animate-spin-slow')}>
        <circle cx="210" cy="196" r="164" stroke="#B88A42" strokeWidth="0.7" strokeDasharray="2 8" />
      </g>

      {/* light rays */}
      <g opacity="0.28">
        {[0, 1, 2, 3, 4].map((i) => (
          <polygon key={i} points={`210,120 ${150 + i * 40},520 ${190 + i * 40},520`} fill="#F5E8CB" className={a('animate-fade-in')} style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
      </g>

      {/* abstract forest */}
      <g fill="url(#rama-forest)">
        <path d="M0 520 V330 C24 300 46 316 62 292 C80 264 92 288 108 322 C124 356 132 400 140 520 Z" opacity="0.75" />
        <path d="M420 520 V318 C394 288 372 306 356 280 C338 252 326 280 310 316 C294 352 286 402 278 520 Z" opacity="0.8" />
        {[52, 88, 330, 366].map((x, i) => (
          <ellipse key={i} cx={x} cy={268 + (i % 2) * 26} rx="46" ry="30" opacity="0.6" />
        ))}
      </g>
      <path d="M0 484 C70 462 130 486 210 478 C290 470 350 490 420 470 V520 H0 Z" fill="#173F38" opacity="0.45" />

      {/* figure */}
      <g className={a('animate-float-slow')} style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}>
        {/* bow (held in the left hand, resting vertically) */}
        <path d="M148 232 C120 280 118 384 146 432" stroke="url(#rama-gold)" strokeWidth="5" strokeLinecap="round" />
        <path d="M148 232 C146 280 146 384 146 432" stroke="#F5E8CB" strokeWidth="0.9" opacity="0.75" />
        <path d="M148 232 C164 262 164 400 146 432" stroke="#EAD3A2" strokeWidth="0.9" opacity="0.4" strokeDasharray="4 4" />

        {/* arrow */}
        <g className={a('animate-sway')} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <line x1="150" y1="238" x2="286" y2="238" stroke="url(#rama-gold)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M286 238 l-16 -5 v10 Z" fill="url(#rama-gold)" />
          <path d="M150 238 l14 -5 v10 Z" fill="#A8BFA8" />
        </g>

        {/* legs & dhoti */}
        <path d="M196 330 C188 366 180 402 176 440 L212 440 C214 402 216 368 214 336 Z" fill="url(#rama-silk)" />
        <path d="M224 330 C232 366 240 402 244 440 L208 440 C210 402 208 368 210 336 Z" fill="url(#rama-silk)" />
        <path d="M176 440 h68" stroke="#7E5B28" strokeWidth="3" strokeLinecap="round" />
        <path d="M186 360 C206 372 224 372 240 358" stroke="#7E5B28" strokeWidth="1.4" opacity="0.55" />
        <path d="M182 392 C204 404 226 404 244 390" stroke="#7E5B28" strokeWidth="1.2" opacity="0.4" />

        {/* torso */}
        <path d="M210 208 C236 208 252 226 254 254 C256 286 250 316 246 336 L174 336 C170 316 164 286 166 254 C168 226 184 208 210 208 Z" fill="url(#rama-skin)" />
        <path d="M210 216 C224 220 236 234 238 254 C239 276 236 306 232 326 L188 326 C184 306 181 276 182 254 C184 234 196 220 210 216 Z" fill="#3E6E93" opacity="0.26" />
        {/* gold chest ornament */}
        <path d="M196 232 C204 244 216 244 224 232" stroke="url(#rama-gold)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="210" cy="248" r="4.6" fill="url(#rama-gold)" />
        {/* waist sash */}
        <path d="M172 320 C190 332 230 332 248 320" stroke="url(#rama-gold)" strokeWidth="5" strokeLinecap="round" />
        <path d="M198 322 l-6 26 M222 322 l6 26" stroke="#B88A42" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

        {/* arms: left rests on the bow, right holds the arrow */}
        <path d="M176 226 C154 248 146 286 148 318" stroke="url(#rama-skin)" strokeWidth="12" strokeLinecap="round" />
        <path d="M244 226 C266 244 276 268 274 292" stroke="url(#rama-skin)" strokeWidth="12" strokeLinecap="round" />
        <circle cx="148" cy="320" r="7" fill="url(#rama-skin)" />
        <circle cx="275" cy="292" r="7" fill="url(#rama-skin)" />

        {/* neck + head */}
        <rect x="203" y="196" width="14" height="16" rx="6" fill="#4A7FA6" />
        <ellipse cx="210" cy="176" rx="31" ry="36" fill="url(#rama-skin)" />
        {/* crown */}
        <path d="M182 150 C182 128 198 116 210 116 C222 116 238 128 238 150 C228 142 192 142 182 150 Z" fill="url(#rama-gold)" />
        <path d="M210 112 l4 10 6 -6 2 12 -12 2 -12 -2 2 -12 6 6 Z" fill="url(#rama-gold)" opacity="0.95" />
        <circle cx="210" cy="132" r="3" fill="#F5E8CB" />
        {/* serene face */}
        <g stroke="#0C2620" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
          <path d="M196 174 q6.5 -5 13 0" />
          <path d="M211 174 q6.5 -5 13 0" />
        </g>
        <path d="M210 180 v8" stroke="#2C4F46" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        <path d="M204 190 q6 3.6 12 0" stroke="#0C2620" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        <path d="M210 166 v-6" stroke="#B88A42" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="181" cy="182" r="3.8" fill="none" stroke="#B88A42" strokeWidth="1.6" />
        <circle cx="239" cy="182" r="3.8" fill="none" stroke="#B88A42" strokeWidth="1.6" />
      </g>

      {/* floating petals */}
      <g fill="#D6A35D">
        {[
          [96, 300, 0],
          [318, 340, 1.8],
          [140, 180, 3.4],
          [286, 208, 4.6],
          [120, 420, 2.6],
        ].map(([x, y, delay], i) => (
          <path
            key={i}
            d={`M${x} ${y} q4 -6 8 0 q-4 6 -8 0 Z`}
            opacity="0.8"
            style={{ animationDelay: `${delay}s` }}
            className={a('animate-petal')}
          />
        ))}
      </g>
    </svg>
  );
}
