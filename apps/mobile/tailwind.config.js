/**
 * Tokens come from lib/palette.js. Colours that change at night are CSS variables
 * set on the root view (`vars()` in app/_layout.tsx); the rest are fixed.
 */
const { fixed, facet } = require("./lib/palette.js");

const themed = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...fixed,
        bg: themed("bg"),
        surface: themed("surface"),
        line: themed("line"),
        fill: themed("fill"),
        accent: themed("accent"),
        "accent-ink": themed("accent-ink"),
        accent2: themed("accent2"),
        text: themed("text"),
        muted: themed("muted"),
        "facet-meal": facet.meal,
        "facet-cuisine": facet.cuisine,
        "facet-diet": facet.diet,
        "facet-effort": facet.effort,
        "facet-vibe": facet.vibe,
      },
      fontFamily: {
        display: ["Baloo2_800ExtraBold"],
        body: ["Nunito_600SemiBold"],
        bold: ["Nunito_800ExtraBold"],
      },
      borderRadius: { card: "20px", input: "14px" },
    },
  },
};
