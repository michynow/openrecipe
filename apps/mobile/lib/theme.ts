import { useColorScheme } from "react-native";

import { dark, facet, fixed, light, px } from "./palette.js";

export type Tone = "ink" | "text" | "muted" | "accent" | "accent-ink" | "surface";
export { cssVars } from "./palette.js";

type Color = Record<Tone | "bg" | "line" | "fill" | "gold" | "sausage" | "leaf" | "sky" | "accent2", string>;

/** Hex for SVG fill/stroke, where classes don't reach. Follows the system scheme. */
export function useTokens(): { color: Color; px: Record<string, string>; facet: typeof facet; scheme: "light" | "dark" } {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const mode = scheme === "dark" ? dark : light;
  const color = { ...fixed, ...mode } as unknown as Color;
  return { color, px, facet, scheme };
}
