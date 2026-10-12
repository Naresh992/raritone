import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0C",
        coal: "#141416",
        ash: "#1E1E21",
        bone: "#ECE6D8",
        volt: "#D7FF00",
        smoke: "#A7A29A",
        blood: { DEFAULT: "#C8102E", bright: "#E10600", dark: "#7A0A1E" },
        paper: "#FAF8F3",
        stoney: { 50: "#FAF8F3", 100: "#F3EFE8", 200: "#E7E0D4", 300: "#D5C9B6", 400: "#B3A48E", 600: "#78716C", 800: "#292524", 900: "#1C1917" },
        clay: { DEFAULT: "#9A4A24", dark: "#7E3A1C", light: "#B45A2E" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
        serif: ["var(--font-serif)", "serif"],
      },
      keyframes: {
        marquee: { to: { transform: "translateX(-50%)" } },
      },
      animation: {
        marquee: "marquee 20s linear infinite",
      },
      boxShadow: {
        brutal: "6px 6px 0 0 #C8102E",
        "brutal-sm": "3px 3px 0 0 #C8102E",
        "brutal-bone": "6px 6px 0 0 #ECE6D8",
      },
      maxWidth: { site: "1280px" },
    },
  },
  plugins: [],
};
export default config;
