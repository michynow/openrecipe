/**
 * Pixel art as text. A sprite is 12 rows of 12 characters; each character is a
 * palette letter (see --px-* in app/globals.css) and "." is transparent.
 *
 * Drawn as text so a sprite can be read and edited in a diff, and rendered as
 * one SVG path per colour so a 12×12 sprite is a handful of nodes, not 144.
 */
export const PIXEL_SIZE = 12;

/** Every letter a sprite may use. Mirrors the --px-* custom properties. */
export const PALETTE = "kwrRoOyYgGbBtpucsS";

/** One `M x y h1 v1 h-1 z` square per pixel of `char`, merged into a single path. */
export function pixelPath(rows: readonly string[], char: string): string {
  let d = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === char) d += `M${x} ${y}h1v1h-1z`;
    }
  });
  return d;
}

/** Each colour a sprite uses, with its path. Order follows the palette. */
export function spriteLayers(rows: readonly string[]): { char: string; d: string }[] {
  const used = new Set(rows.join(""));
  return [...PALETTE].filter((char) => used.has(char)).map((char) => ({ char, d: pixelPath(rows, char) }));
}

/** Why a sprite is malformed, or null when it is fine. For the tests. */
export function spriteProblem(rows: readonly string[], allowed = `.${PALETTE}`): string | null {
  if (rows.length !== PIXEL_SIZE) return `${rows.length} rows`;
  for (const [y, row] of rows.entries()) {
    if (row.length !== PIXEL_SIZE) return `row ${y} is ${row.length} wide`;
    const bad = [...row].find((char) => !allowed.includes(char));
    if (bad) return `row ${y} uses "${bad}"`;
  }
  return null;
}
