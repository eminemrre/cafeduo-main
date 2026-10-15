/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './backend/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Legacy cyber palette — kept for CyberGlitchScreen/Admin accents only.
         * New code must use paper/carbon/riso tokens. */
        cyber: {
          bg: '#050a19',
          dark: '#020713',
          card: 'rgba(11, 22, 44, 0.75)',
          border: 'rgba(0, 243, 255, 0.3)',
        },
        neon: {
          blue: '#00f3ff',
          pink: '#ff00ea',
          green: '#39d98a',
          yellow: '#f5c16c',
        },
        ink: {
          50: '#f4f5f7',
          100: '#e6e8ec',
          200: '#c9ced6',
          300: '#a7b0bd',
          400: '#7f8b9b',
          500: '#5f6d7a',
          600: '#4b5660',
          700: '#3d444c',
          800: '#2f353b',
          900: '#1f2328',
        },
        // Riso Kantin palette — PR #24. Mirrors the CSS vars defined under
        // `.riso-kantin` in index.css so Tailwind autocompletes them and
        // arbitrary-value users get type-checked names.
        paper: {
          DEFAULT: '#FBF7EE',
          deep: '#F2EAD8',
          dim: '#ECE3CC',
        },
        carbon: {
          DEFAULT: '#141413',
          soft: '#2A2A28',
          muted: '#6A6A66',
        },
        riso: {
          pink: '#FF3E94',
          'pink-deep': '#D8246F',
          blue: '#1E3FB5',
          'blue-deep': '#142C82',
          mustard: '#F1B41E',
          'mustard-deep': '#C9921A',
          spring: '#5BC25A',
          redox: '#E03B1E',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', '"Chakra Petch"', '"Noto Sans"', 'sans-serif'],
        display: ['"Press Start 2P"', '"Space Grotesk"', 'monospace'],
        body: ['"Space Grotesk"', '"Chakra Petch"', '"Noto Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        // Riso Kantin
        'riso-display': ['"Unbounded Variable"', '"Unbounded"', 'system-ui', 'sans-serif'],
        'riso-body': ['"Familjen Grotesk"', 'system-ui', 'sans-serif'],
        'riso-mono': ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 17, 21, 0.35)',
        glow: '0 0 0 1px rgba(245, 193, 108, 0.35), 0 12px 30px rgba(245, 193, 108, 0.2)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
      },
      letterSpacing: {
        wide: '0.08em',
        wider: '0.14em',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
