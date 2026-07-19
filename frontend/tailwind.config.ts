import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17151A",
        paper: "#FAFAF7",
        danger: {
          DEFAULT: "#FF3B30",
          50: "#FFF1EF",
          100: "#FFE1DC",
          400: "#FF6A52",
          500: "#FF3B30",
          600: "#E22A20",
          700: "#B81F17",
        },
        safe: {
          DEFAULT: "#16C784",
          50: "#EAFBF4",
          100: "#CEF6E4",
          400: "#2FDC9B",
          500: "#16C784",
          600: "#0FA76B",
          700: "#0B8556",
        },
        amber: {
          DEFAULT: "#FFB020",
          50: "#FFF7E8",
          100: "#FFEBC2",
          500: "#FFB020",
          600: "#E0940A",
        },
        signal: {
          DEFAULT: "#0E7C86",
          50: "#E9F6F7",
          100: "#CDEBEE",
          400: "#1B9BA6",
          500: "#0E7C86",
          600: "#0A626B",
          700: "#084E55",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        soft: "0 8px 30px -8px rgba(23, 21, 26, 0.12)",
        card: "0 4px 20px -6px rgba(23, 21, 26, 0.10)",
        glow: "0 0 0 6px rgba(255, 59, 48, 0.10)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "80%": { transform: "scale(1.9)", opacity: "0" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulseRing 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
        "float-in": "floatIn 0.35s ease-out",
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
