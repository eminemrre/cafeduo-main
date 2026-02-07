/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./App.tsx", "./index.tsx", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}", "./backend/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f7f2ee",
          100: "#efe5da",
          200: "#dfc8b7",
          300: "#cfa993",
          400: "#b98369",
          500: "#9e684f",
          600: "#8a5a45",
          700: "#71483a",
          800: "#5b3b31",
          900: "#4a312b",
        },
        accent: {
          50: "#f4fbf7",
          100: "#e6f6ed",
          200: "#c8ecd8",
          300: "#9edeb7",
          400: "#6ecb92",
          500: "#3fb06f",
          600: "#2f8f59",
          700: "#257246",
          800: "#1f5a39",
          900: "#1a4a30",
        },
        ink: {
          50: "#f4f5f7",
          100: "#e6e8ec",
          200: "#c9ced6",
          300: "#a7b0bd",
          400: "#7f8b9b",
          500: "#5f6d7a",
          600: "#4b5660",
          700: "#3d444c",
          800: "#2f353b",
          900: "#1f2328",
        },
        surface: {
          base: "#0f1115",
          elevated: "#171a20",
          raised: "#1f232b",
          card: "#262b35",
        },
        highlight: "#f5c16c",
      },
      fontFamily: {
        sans: ['"Noto Sans"', '"Exo 2"', "sans-serif"],
        display: ['"Noto Sans"', '"Exo 2"', "sans-serif"],
        pixel: ['"Noto Sans"', '"Exo 2"', "sans-serif"],
        retro: ['"JetBrains Mono"', '"Noto Sans"', "monospace"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 17, 21, 0.35)",
        glow: "0 0 0 1px rgba(245, 193, 108, 0.35), 0 12px 30px rgba(245, 193, 108, 0.2)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2.25rem",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem",
      },
      letterSpacing: {
        wide: "0.08em",
        wider: "0.14em",
      },
      backgroundImage: {
        "radial-spotlight": "radial-gradient(60% 60% at 50% 0%, rgba(245, 193, 108, 0.2), rgba(0, 0, 0, 0))",
        grain: "url('/textures/grain.png')",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-soft": "pulse-soft 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
