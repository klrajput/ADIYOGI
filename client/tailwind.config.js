/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Calm, warm-neutral base ("paper") rather than pure white.
        paper: '#F8F6F1',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#16202B',
          soft: '#2C3A48',
          muted: '#5B6674',
          faint: '#8A94A0',
        },
        line: {
          DEFAULT: '#E4E0D7',
          strong: '#CFC9BC',
        },
        // Deep teal — trust, calm, grounded (primary actions).
        primary: {
          50: '#EAF3F1',
          100: '#D3E7E3',
          200: '#A9CFC8',
          300: '#7BB5AC',
          400: '#4E968C',
          500: '#2C7A6F',
          600: '#1D6258',
          700: '#17564E',
          800: '#12443E',
          900: '#0D332F',
        },
        // Warm amber — warmth, hope, spiritual restraint (accents only).
        accent: {
          50: '#FBF3E4',
          100: '#F5E5C6',
          200: '#EACB92',
          300: '#DDB05E',
          400: '#C99640',
          500: '#B8863B',
          600: '#9A6C2B',
          700: '#7C5520',
          800: '#5E4018',
        },
        // Muted clay — used only for crisis/safety surfaces.
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
        support: {
          50: '#EEF2F8',
          100: '#D9E2EF',
          200: '#B3C4DC',
          300: '#88A2C4',
          400: '#5E81A8',
          500: '#3B5C86',
          600: '#2E4869',
        },
      },
      fontFamily: {
        // System stacks only: no third-party font requests means no IP leak to
        // Google Fonts from a mental-health platform.
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'ui-serif',
          'Iowan Old Style',
          'Palatino Linotype',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'serif',
        ],
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,32,43,0.04), 0 4px 16px -8px rgba(22,32,43,0.10)',
        lift: '0 2px 4px rgba(22,32,43,0.05), 0 12px 32px -12px rgba(22,32,43,0.18)',
        focus: '0 0 0 3px rgba(44,122,111,0.28)',
      },
      maxWidth: {
        prose: '68ch',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(0.94)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        breathe: 'breathe 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
