/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: { DEFAULT: "#06060b", 900: "#0a0a12", 800: "#0f0f1a", 700: "#161625", 600: "#1e1e30" },
        mint: { DEFAULT: "#00e6b4", dim: "#00e6b420", glow: "#00e6b440" },
      },
      fontFamily: {
        display: ["'Outfit'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: { '0%, 100%': { opacity: '0.4' }, '50%': { opacity: '0.8' } },
      },
    },
  },
  plugins: [],
};
