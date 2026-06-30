import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Accent: teal. The whole UI references this single `brand` scale, so
        // this is the one place the accent colour is defined.
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        // Near-black "ink" used for the dominant pill buttons and dark accent
        // tiles in the bento system (kept slightly warm so it doesn't read blue).
        ink: {
          DEFAULT: "#15160f",
          800: "#202219",
          700: "#2b2d22",
        },
        // Dark-mode neutral surfaces (used via dark: variants). Cool slate to
        // match the design direction.
        night: {
          950: "#0b0f17", // page background
          900: "#121826", // card surface
          850: "#161d2c", // elevated surface (inputs, raised tiles)
          800: "#1b2433", // tag / chip background
          line: "#222b3a", // hairline border / ring
          line2: "#1c2433", // subtle divider
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
