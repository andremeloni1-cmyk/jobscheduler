import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Accent: warm orange. The whole UI references this single `brand` scale,
        // so this is the one place the accent colour is defined. (Black & white
        // scheme — orange is the only chromatic accent.)
        brand: {
          50: "#fff5ed",
          100: "#ffe7d4",
          200: "#feccab",
          300: "#fdac76",
          400: "#fb8b4c",
          500: "#f2752f",
          600: "#e25f1c",
          700: "#bb4716",
          800: "#943919",
          900: "#773117",
          950: "#40160a",
        },
        // Pure near-black "ink" — the dominant pill buttons and dark accent tiles.
        ink: {
          DEFAULT: "#111111",
          800: "#1f1f1f",
          700: "#2a2a2a",
        },
        // Dark-mode surfaces — neutral near-black greys for a crisp B&W dark theme.
        night: {
          950: "#0a0a0a", // page background
          900: "#141414", // card surface
          850: "#1c1c1c", // elevated surface (inputs, raised tiles)
          800: "#242424", // tag / chip background
          line: "#2e2e2e", // hairline border / ring
          line2: "#1f1f1f", // subtle divider
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Bento card geometry — large, soft corners.
        bento: "26px",
        "bento-sm": "18px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.08)",
        // Soft, lifted bento shadow (cards float on the muted page background).
        bento: "0 10px 30px -12px rgba(16,24,40,0.18), 0 2px 6px -2px rgba(16,24,40,0.06)",
        lift: "0 6px 16px -4px rgba(16,24,40,0.12), 0 2px 6px -2px rgba(16,24,40,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
