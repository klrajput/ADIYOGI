/**
 * AdiYogi mark — an ORIGINAL, stylised SVG illustration of Lord Shiva in meditation
 * (no photographs, no third-party artwork). Layered SVG + CSS animation only, so it
 * stays crisp at any size and costs no image payload.
 *
 * Decorative by default (aria-hidden). Pass `title` to expose it as a labelled image.
 */
export default function ShivaMeditation({ className = '', title, animated = true }) {
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
        <radialGradient id="shiva-aura" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#EAD3A2" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#B88A42" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#142D46" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shiva-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A9CFE4" />
          <stop offset="55%" stopColor="#6FA3C7" />
          <stop offset="100%" stopColor="#3E6E93" />
        </linearGradient>
        <linearGradient id="shiva-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2C4F46" />
          <stop offset="60%" stopColor="#1B3A33" />
          <stop offset="100%" stopColor="#0C2620" />
        </linearGradient>
        <linearGradient id="shiva-cloth" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C795" />
          <stop offset="50%" stopColor="#D6A35D" />
          <stop offset="100%" stopColor="#9C7233" />
        </linearGradient>
        <linearGradient id="shiva-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5E8CB" />
          <stop offset="50%" stopColor="#B88A42" />
          <stop offset="100%" stopColor="#7E5B28" />
        </linearGradient>
        <linearGradient id="shiva-ganga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6F4FF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#8FD3E8" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="shiva-mountain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D9D5E8" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#2F4C6E" stopOpacity="0.15" />
        </linearGradient>
        <filter id="shiva-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ---------- aura + mandala field ---------- */}
      <circle cx="210" cy="236" r="196" fill="url(#shiva-aura)" className={a('animate-aura-pulse')} />
      <g stroke="#EAD3A2" strokeWidth="0.7" opacity="0.42" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className={a('animate-spin-slow')}>
        <circle cx="210" cy="236" r="168" strokeDasharray="2 7" />
        <circle cx="210" cy="236" r="150" opacity="0.6" />
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 24;
          const r1 = 150;
          const r2 = i % 3 === 0 ? 164 : 158;
          return (
            <line
              key={i}
              x1={210 + Math.cos(angle) * r1}
              y1={236 + Math.sin(angle) * r1}
              x2={210 + Math.cos(angle) * r2}
              y2={236 + Math.sin(angle) * r2}
              strokeWidth="0.8"
            />
          );
        })}
      </g>

      {/* ---------- abstract Himalayan horizon ---------- */}
      <path d="M0 462 L74 386 L122 428 L188 352 L246 424 L300 372 L356 420 L420 358 V520 H0 Z" fill="url(#shiva-mountain)" />
      <path d="M0 492 L92 438 L158 480 L232 424 L306 476 L374 442 L420 470 V520 H0 Z" fill="#142D46" opacity="0.35" />

      {/* ---------- drifting cosmic particles ---------- */}
      <g fill="#F5E8CB">
        {[
          [78, 168, 1.6, 0],
          [122, 96, 1.1, 1.6],
          [318, 132, 1.8, 0.8],
          [352, 226, 1.2, 2.4],
          [64, 268, 1.4, 3.2],
          [286, 88, 1.2, 2],
          [150, 62, 1.5, 4],
          [372, 320, 1.1, 1.2],
        ].map(([x, y, r, delay], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            opacity="0.75"
            style={{ animationDelay: `${delay}s` }}
            className={a('animate-drift')}
          />
        ))}
      </g>

      {/* ---------- trishul ---------- */}
      <g opacity="0.92">
        <rect x="330" y="238" width="3.4" height="196" rx="1.7" fill="url(#shiva-gold)" />
        <path d="M331.7 250 C312 236 306 214 316 196 C322 206 328 214 331.7 222 Z" fill="url(#shiva-gold)" />
        <path d="M331.7 250 C351 236 357 214 347 196 C341 206 335 214 331.7 222 Z" fill="url(#shiva-gold)" />
        <path d="M331.7 246 C327 226 330 208 331.7 190 C333.4 208 336 226 331.7 246 Z" fill="url(#shiva-gold)" />
        <circle cx="331.7" cy="258" r="4.4" fill="url(#shiva-gold)" />
      </g>

      {/* ---------- meditating figure ---------- */}
      <g className={a('animate-float-slow')} style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}>
        {/* matted hair (jata) */}
        <g className={a('animate-sway')} style={{ transformBox: 'fill-box', transformOrigin: '50% 30%' }}>
          <path
            d="M210 168 C182 166 160 182 150 206 C142 226 146 248 138 268 C154 258 160 240 166 222 C170 244 162 262 154 280 C172 270 180 248 184 226 C188 250 184 268 178 286 C196 274 202 250 204 224 Z"
            fill="url(#shiva-hair)"
          />
          <path
            d="M210 168 C238 166 260 182 270 206 C278 226 274 248 282 268 C266 258 260 240 254 222 C250 244 258 262 266 280 C248 270 240 248 236 226 C232 250 236 268 242 286 C224 274 218 250 216 224 Z"
            fill="url(#shiva-hair)"
          />
          <path d="M210 158 C196 150 186 138 190 124 C198 132 206 138 210 146 C214 138 222 132 230 124 C234 138 224 150 210 158 Z" fill="url(#shiva-hair)" />
        </g>

        {/* crescent moon */}
        <path
          d="M262 132 C248 130 236 140 234 154 C246 146 262 148 270 158 C272 148 270 138 262 132 Z"
          fill="url(#shiva-gold)"
          className={a('animate-aura-pulse')}
        />

        {/* Ganga stream from the hair */}
        <path
          d="M206 160 C198 182 214 196 200 216 C188 234 202 250 192 264"
          stroke="url(#shiva-ganga)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="10 7"
          className={a('animate-pulse-soft')}
          opacity="0.9"
        />

        {/* torso */}
        <path
          d="M210 232 C238 232 256 250 258 278 C260 310 252 342 246 364 L174 364 C168 342 160 310 162 278 C164 250 182 232 210 232 Z"
          fill="url(#shiva-skin)"
        />
        {/* chest shading + rudraksha */}
        <path d="M210 240 C226 244 238 258 240 278 C241 300 236 330 232 350 L188 350 C184 330 179 300 180 278 C182 258 194 244 210 240 Z" fill="#3E6E93" opacity="0.28" />
        <g fill="none" stroke="#B88A42" strokeWidth="1.6" opacity="0.9">
          {Array.from({ length: 5 }).map((_, i) => (
            <circle key={i} cx={190 + i * 10} cy={282 + Math.abs(2 - i) * 3} r="2.6" />
          ))}
          <circle cx="210" cy="306" r="4.4" fill="#B88A42" opacity="0.55" />
        </g>
        {/* snake around the neck */}
        <path d="M180 252 C190 264 230 264 240 252" stroke="#A8BFA8" strokeWidth="5.2" strokeLinecap="round" />
        <path d="M240 252 C248 250 252 244 250 238" stroke="#A8BFA8" strokeWidth="4" strokeLinecap="round" />
        <circle cx="250" cy="237" r="2.6" fill="#7F9C80" />
        <circle cx="249" cy="236" r="0.9" fill="#0C2620" />

        {/* arms in dhyana mudra */}
        <path d="M174 268 C152 282 146 314 160 340 C166 352 178 358 188 356" stroke="url(#shiva-skin)" strokeWidth="13" strokeLinecap="round" />
        <path d="M246 268 C268 282 274 314 260 340 C254 352 242 358 232 356" stroke="url(#shiva-skin)" strokeWidth="13" strokeLinecap="round" />
        <ellipse cx="192" cy="358" rx="12" ry="7" fill="url(#shiva-skin)" />
        <ellipse cx="228" cy="358" rx="12" ry="7" fill="url(#shiva-skin)" />
        <path d="M186 360 q6 5 12 0" stroke="#2C4F46" strokeWidth="1.2" opacity="0.5" />

        {/* crossed legs / lotus seat */}
        <path
          d="M210 352 C240 352 268 362 292 382 C300 390 296 402 284 406 C258 414 232 418 210 418 C188 418 162 414 136 406 C124 402 120 390 128 382 C152 362 180 352 210 352 Z"
          fill="url(#shiva-cloth)"
        />
        <path d="M168 384 C188 392 232 392 252 384" stroke="#7E5B28" strokeWidth="1.4" opacity="0.5" />
        <path d="M140 398 C176 410 244 410 280 398" stroke="#7E5B28" strokeWidth="1.2" opacity="0.4" />
        <path d="M210 356 C204 368 204 380 210 392" stroke="#7E5B28" strokeWidth="1.2" opacity="0.45" />

        {/* neck + head */}
        <rect x="202" y="220" width="16" height="18" rx="7" fill="#4A7FA6" />
        <ellipse cx="210" cy="200" rx="34" ry="40" fill="url(#shiva-skin)" />
        <path d="M176 196 C176 172 190 156 210 156 C230 156 244 172 244 196 C244 214 234 228 220 234 C224 220 222 206 214 198 C204 204 190 204 180 198 Z" fill="#3E6E93" opacity="0.22" />

        {/* serene face */}
        <g stroke="#0C2620" strokeWidth="1.9" strokeLinecap="round" opacity="0.85">
          <path d="M194 198 q7 -5.5 14 0" fill="none" />
          <path d="M212 198 q7 -5.5 14 0" fill="none" />
        </g>
        <path d="M188 188 q8 -4 16 -1" stroke="#1B3A33" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        <path d="M216 187 q8 -3 16 1" stroke="#1B3A33" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        <path d="M210 202 v9" stroke="#2C4F46" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
        <path d="M210 211 q-4 4 -7 2" stroke="#2C4F46" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        <path d="M203 218 q7 4 14 0" stroke="#0C2620" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        {/* third eye */}
        <ellipse cx="210" cy="184" rx="3.4" ry="5.2" fill="#B88A42" opacity="0.95" />
        <ellipse cx="210" cy="184" rx="6.6" ry="8.4" fill="#EAD3A2" opacity="0.3" filter="url(#shiva-soft)" />
        {/* tilak */}
        <path d="M210 178 v-8" stroke="#B88A42" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
        {/* earrings */}
        <circle cx="176" cy="206" r="4.2" fill="none" stroke="#B88A42" strokeWidth="1.8" />
        <circle cx="244" cy="206" r="4.2" fill="none" stroke="#B88A42" strokeWidth="1.8" />
      </g>

      {/* ---------- floating petals ---------- */}
      <g fill="#D6A35D" opacity="0.75">
        {[
          [112, 320, 0],
          [304, 372, 2.6],
          [96, 408, 4.4],
        ].map(([x, y, delay], i) => (
          <ellipse key={i} cx={x} cy={y} rx="3.6" ry="2" style={{ animationDelay: `${delay}s` }} className={a('animate-petal')} />
        ))}
      </g>
    </svg>
  );
}
