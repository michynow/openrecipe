import { formatNumber } from "./format.ts";

/**
 * Scaling and rendering Ingredient Line quantities.
 *
 * Scaling is display-only — the stored Recipe is never rewritten (PRD §7.5).
 */

/**
 * Scale a quantity by a serving ratio.
 *
 * A null quantity stays null. That is the whole point: "sól — do smaku" has no
 * number, and multiplying nothing must not invent "1,5 do smaku".
 */
export function scaleQuantity(
  quantity: number | null,
  factor: number,
): number | null {
  if (quantity === null) return null;
  return quantity * factor;
}

/**
 * Vulgar fractions people actually write in recipes. Sixteenths and sevenths are
 * deliberately absent — nobody measures ⅐ of an onion, and offering it would make
 * the output look computed rather than cooked.
 */
const FRACTIONS: ReadonlyArray<readonly [numerator: number, denominator: number, glyph: string]> = [
  [1, 8, "⅛"],
  [1, 6, "⅙"],
  [1, 5, "⅕"],
  [1, 4, "¼"],
  [1, 3, "⅓"],
  [3, 8, "⅜"],
  [2, 5, "⅖"],
  [1, 2, "½"],
  [3, 5, "⅗"],
  [5, 8, "⅝"],
  [2, 3, "⅔"],
  [3, 4, "¾"],
  [4, 5, "⅘"],
  [5, 6, "⅚"],
  [7, 8, "⅞"],
];

/** How far off a value may be and still be called a fraction. */
const TOLERANCE = 0.02;

/**
 * Render a quantity the way it would be written on a recipe card.
 *
 * Prefers a vulgar fraction when the value is close to one, because "¾ szklanki"
 * is a measurement and "0,75 szklanki" is a spreadsheet. Falls back to a Polish
 * decimal when nothing fits.
 */
export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return "";

  const sign = quantity < 0 ? "-" : "";
  const value = Math.abs(quantity);

  const whole = Math.floor(value + TOLERANCE / 2);
  const remainder = value - whole;

  // Close enough to a whole number: no fraction, no trailing zeros.
  if (remainder < TOLERANCE) {
    return sign + formatNumber(whole);
  }

  const match = FRACTIONS.find(
    ([numerator, denominator]) =>
      Math.abs(remainder - numerator / denominator) < TOLERANCE,
  );

  if (match) {
    const glyph = match[2];
    return whole === 0 ? sign + glyph : `${sign}${formatNumber(whole)}${glyph}`;
  }

  // No tidy fraction — a Polish decimal is more honest than a wrong fraction.
  return sign + formatNumber(Number(value.toFixed(2)));
}

/** Convenience for the common case: scale, then render. Null renders as "". */
export function formatScaledQuantity(
  quantity: number | null,
  factor: number,
): string {
  const scaled = scaleQuantity(quantity, factor);
  return scaled === null ? "" : formatQuantity(scaled);
}
