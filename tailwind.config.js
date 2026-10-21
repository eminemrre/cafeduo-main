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
        /* Design v2 (DESIGN.md): paper is the white surface, paper-deep is the ice
         * ground Masa screens sit on, paper-dim is the well inside a surface. */
        paper: {
          DEFAULT: '#FFFFFF',
          deep: '#EEF6F8',
          dim: '#D9EAEF',
        },
        carbon: {
          DEFAULT: '#17140F',
          soft: '#2A251C',
          muted: '#4A4540',
        },
        /* The candy set from DESIGN.md: lokum, gök, limon, fıstık. Fills only —
         * candy used as text is deepened in identity.css, never lightened. */
        candy: {
          lokum: '#FF5C8A',
          'lokum-deep': '#E03A6B',
          gok: '#1FB3FF',
          'gok-deep': '#0E7CC0',
          limon: '#FFD23F',
          'limon-deep': '#E0AE18',
          fistik: '#B6D31B',
          deniz: '#2EC4B6',
          danger: '#D62F2F',
        },
      },
      /* Design v2: Baloo 2 draws every display line, Onest every other line.
       * candy-mono renders Onest with tabular figures, so codes, scores and
       * timers keep their alignment without a second family. */
      fontFamily: {
        sans: ['"Onest"', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['"Onest"', 'system-ui', 'sans-serif'],
        mono: ['"Onest"', 'system-ui', 'sans-serif'],
        'candy-display': ['"Baloo 2"', 'system-ui', 'sans-serif'],
        'candy-body': ['"Onest"', 'system-ui', 'sans-serif'],
        'candy-mono': ['"Onest"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
