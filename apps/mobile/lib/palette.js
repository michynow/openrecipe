/**
 * The only file with hex. Mirrors apps/web/app/globals.css (Snack Arcade).
 * CommonJS so tailwind.config.js can require it.
 */
const light = {
  bg: "#fff1c9", // custard
  surface: "#fffaf0", // plate
  line: "#1d1033", // ink: every outline and hard shadow
  fill: "#ffe0a3", // crust: placeholders, skeletons
  accent: "#c0221a",
  "accent-ink": "#ffffff",
  accent2: "#7a2bc9",
  text: "#1d1033",
  muted: "#5b4a6e",
};

// Arcade at night: only these change; ink, gold and the stickers stay.
const dark = {
  bg: "#1a1030",
  surface: "#2b1d4d",
  line: "#07030f",
  fill: "#3d2a66",
  accent: "#ff6a55",
  "accent-ink": "#1d1033",
  accent2: "#d39bff",
  text: "#fff4dc",
  muted: "#c9b8e6",
};

// Same in both modes.
const fixed = {
  ink: "#1d1033",
  gold: "#ffc61a",
  sausage: "#c0492b",
  leaf: "#3fae49",
  sky: "#59b8e8",
};

// One colour per Tag Facet; ink text on every one.
const facet = {
  meal: "#ffc61a",
  cuisine: "#59b8e8",
  diet: "#6fd36b",
  effort: "#ff9a3c",
  vibe: "#e3a6ff",
};

// Pixel-art palette (core/pixel.ts PALETTE letters). Fixed, like a photo.
const px = {
  k: "#1d1033",
  w: "#fffaf0",
  r: "#e23b2e",
  R: "#9e1f1a",
  o: "#ff8a1f",
  O: "#d4600f",
  y: "#ffd23f",
  Y: "#d99a00",
  g: "#4cbb47",
  G: "#23752b",
  b: "#a0662f",
  B: "#5e3519",
  t: "#f0c98f",
  p: "#ff9bb3",
  u: "#8a3fd1",
  c: "#59b8e8",
  n: "#2b4bb3",
  s: "#c9c2d6",
  S: "#7a7290",
};

/** "#rrggbb" -> "r g b", for `rgb(var(--x) / <alpha-value>)` in Tailwind. */
const channels = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

/** CSS variables NativeWind's `vars()` sets on the root view for one scheme. */
const cssVars = (scheme) =>
  Object.fromEntries(
    Object.entries(scheme === "dark" ? dark : light).map(([k, v]) => [`--color-${k}`, channels(v)]),
  );

module.exports = { light, dark, fixed, facet, px, channels, cssVars };
