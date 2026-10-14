export const light: Record<string, string>;
export const dark: Record<string, string>;
export const fixed: Record<"ink" | "gold" | "sausage" | "leaf" | "sky", string>;
export const facet: Record<"meal" | "cuisine" | "diet" | "effort" | "vibe", string>;
export const px: Record<string, string>;
export function channels(hex: string): string;
export function cssVars(scheme: "light" | "dark"): Record<string, string>;
