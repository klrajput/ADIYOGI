/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* ---- Calm base: cream paper, warm ivory surfaces, deep-forest ink ---- */
        paper: '#F5F0E6',
        surface: '#FFFDF7',
        ink: {
          DEFAULT: '#173F38',
          soft: '#2C4F46',
          muted: '#5A6F68',
          faint: '#7C8C86',
        },
        line: {
          DEFAULT: '#E3DCCD',
          strong: '#CFC5B0',
        },
        /* ---- Deep forest green: primary intent, calm and grounded ---- */
        primary: {
          50: '#EAF1ED',
          100: '#D3E4DC',
          200: '#A9C9BC',
          300: '#7CAB99',
          400: '#4E8A75',
          500: '#2C6B5C',
          600: '#1F5548',
          700: '#173F38',
          800: '#12332D',
          900: '#0C2620',
        },
        /* ---- Antique gold: restrained divine accent ---- */
        accent: {
          50: '#FBF4E6',
          100: '#F5E8CB',
          200: '#EAD3A2',
          300: '#DCB878',
          400: '#C99E55',
          500: '#B88A42',
          600: '#9C7233',
          700: '#7E5B28',
          800: '#63471F',
        },
        /* ---- Muted clay: crisis/safety surfaces only ---- */
        crisis: {
          50: '#FBEDE8',
          100: '#F6D8CE',
          200: '#E9AD9B',
          300: '#D9806A',
          400: '#C05B42',
          500: '#A8442C',
          600: '#8C3521',
          700: '#6F2A1B',
        },
        /* ---- Cosmic blue: spiritual night scenes ---- */
        support: {
          50: '#EDF1F6',
          100: '#D8E1EC',
          200: '#B0C1D6',
          300: '#839BB8',
          400: '#577494',
          500: '#2F4C6E',
          600: '#1F3A57',
          700: '#142D46',
          800: '#102437',
          900: '#0B1A27',
        },
        /* ---- Named palette additions from the design brief ---- */
        sage: { DEFAULT: '#A8BFA8', light: '#C8D8C7', deep: '#7F9C80' },
        saffron: { DEFAULT: '#D6A35D', soft: '#E8C795' },
        lavender: { DEFAULT: '#D9D5E8', soft: '#ECE9F4', deep: '#A9A2C4' },
        cosmic: { DEFAULT: '#142D46', deep: '#0B1A27', ink: '#081420', haze: '#1F3A57' },
      },
      fontFamily: {
        // Self-hosted (client/src/assets/fonts) — no third-party font requests from a
        // mental-health platform.
        sans: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Playfair Display', 'Cormorant Garamond', 'ui-serif', 'Iowan Old Style', 'Georgia', 'serif'],
        deva: ['Noto Sans Devanagari', 'Manrope', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,63,56,0.05), 0 6px 20px -12px rgba(23,63,56,0.18)',
        lift: '0 2px 6px rgba(23,63,56,0.06), 0 18px 44px -18px rgba(23,63,56,0.28)',
        focus: '0 0 0 3px rgba(184,138,66,0.35)',
        glass: '0 8px 32px -12px rgba(8,20,32,0.35), inset 0 1px 0 rgba(255,253,247,0.35)',
        glow: '0 0 40px -8px rgba(184,138,66,0.45), 0 0 90px -30px rgba(168,191,168,0.35)',
        'glow-blue': '0 0 60px -18px rgba(131,155,184,0.55)',
      },
      backgroundImage: {
        'cosmic-rise': 'linear-gradient(180deg, #0B1A27 0%, #142D46 42%, #173F38 100%)',
        'cosmic-soft': 'linear-gradient(160deg, #102437 0%, #142D46 55%, #1F3A57 100%)',
        'sacred-gold': 'linear-gradient(135deg, #EAD3A2 0%, #B88A42 45%, #7E5B28 100%)',
        'dawn-wash': 'linear-gradient(180deg, #FFFDF7 0%, #F5F0E6 45%, #ECE4D3 100%)',
        'sage-mist': 'linear-gradient(135deg, #EAF1ED 0%, #F5F0E6 55%, #EAD3A2 130%)',
        'lotus-glow': 'radial-gradient(circle at 50% 40%, rgba(184,138,66,0.24), transparent 62%)',
      },
      maxWidth: {
        prose: '68ch',
        hero: '84rem',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        divine: 'cubic-bezier(0.35, 0.02, 0.18, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(0.96)' },
          '50%': { opacity: '0.95', transform: 'scale(1.03)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-16px) rotate(0.6deg)' },
        },
        sway: {
          '0%, 100%': { transform: 'rotate(-1.4deg)' },
          '50%': { transform: 'rotate(1.4deg)' },
        },
        'aura-pulse': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.97)' },
          '50%': { opacity: '0.75', transform: 'scale(1.04)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '0.9' },
        },
        drift: {
          '0%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(14px,-22px,0)' },
          '100%': { transform: 'translate3d(0,0,0)' },
        },
        'rise-fade': {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-180% 0' },
          '100%': { backgroundPosition: '180% 0' },
        },
        ripple: {
          '0%': { transform: 'scale(1)', opacity: '0.45' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        petal: {
          '0%': { transform: 'translate3d(0,-12px,0) rotate(0deg)', opacity: '0' },
          '12%': { opacity: '0.9' },
          '100%': { transform: 'translate3d(-26px,120px,0) rotate(160deg)', opacity: '0' },
        },
        'wave-slide': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease both',
        breathe: 'breathe 6s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 11s ease-in-out infinite',
        sway: 'sway 9s ease-in-out infinite',
        'aura-pulse': 'aura-pulse 7s ease-in-out infinite',
        twinkle: 'twinkle 4.5s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
        'rise-fade': 'rise-fade 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        shimmer: 'shimmer 2.6s linear infinite',
        ripple: 'ripple 3.6s ease-out infinite',
        'spin-slow': 'spin-slow 46s linear infinite',
        petal: 'petal 9s linear infinite',
        'wave-slide': 'wave-slide 14s linear infinite',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
