import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fbf6ef",
          100: "#f3e6d3",
          200: "#e6caa6",
          300: "#d6a870",
          400: "#c98c48",
          500: "#b9742f",
          600: "#a05c26",
          700: "#814622",
          800: "#6a3a22",
          900: "#58311f",
          950: "#31180f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
