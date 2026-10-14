/**
 * Palette tokens mirror apps/web/app/globals.css (Snack Arcade, light mode).
 * Hex lives only here; components use the names. Phase 2 does dark mode and the look.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#fff1c9",
        surface: "#fffaf0",
        line: "#1d1033",
        fill: "#ffe0a3",
        gold: "#ffc61a",
        ink: "#1d1033",
        sausage: "#c0492b",
        leaf: "#3fae49",
        sky: "#59b8e8",
        accent: "#c0221a",
        "accent-ink": "#ffffff",
        accent2: "#7a2bc9",
        text: "#1d1033",
        muted: "#5b4a6e",
      },
      borderRadius: { card: "20px", input: "14px" },
    },
  },
};
