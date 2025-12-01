/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                pixel: ['"Chakra Petch"', 'sans-serif'],
                retro: ['"VT323"', 'monospace'],
            },
            colors: {
                dark: '#0f172a',
                primary: '#3b82f6',
                secondary: '#a855f7',
                accent: '#ef4444',
            },
            animation: {
                'glitch': 'glitch 1s linear infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-x': 'bounceX 1s infinite',
            },
            keyframes: {
                glitch: {
                    '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
                    '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
                    '62%': { transform: 'translate(0,0) skew(5deg)' },
                },
                bounceX: {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '50%': { transform: 'translateX(25%)' },
                }
            }
        },
    },
    plugins: [],
}
