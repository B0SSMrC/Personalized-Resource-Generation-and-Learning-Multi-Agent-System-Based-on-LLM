/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ['"Space Grotesk"', "ui-sans-serif", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 10px 30px rgba(76,29,149,.07)",
        glow: "0 0 0 1px rgba(124,58,237,.18), 0 10px 34px rgba(124,58,237,.22)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "none" },
        },
      },
      animation: {
        rise: "rise .35s ease-out both",
      },
    },
  },
  plugins: [],
};
