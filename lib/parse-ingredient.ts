/**
 * Naive splitting of a pasted ingredient line into quantity / unit / item / note.
 *
 * A convenience for hand entry, not a promise. The result is dropped straight into
 * editable inputs so a wrong guess costs a keystroke to fix — which is why this is
 * deliberately simple rather than clever. The Worker's model does the good version
 * at import time (OR-42).
 */

export type ParsedLine = {
  quantity: number | null;
  unit: string | null;
  item: string;
  note: string | null;
};

/** Units common in Polish recipes, plus the metric ones people type in English. */
const UNITS = [
  "g", "kg", "mg",
  "ml", "l", "dl",
  "łyżka", "łyżki", "łyżek",
  "łyżeczka", "łyżeczki", "łyżeczek",
  "szklanka", "szklanki", "szklanek",
  "szczypta", "szczypty",
  "ząbek", "ząbki", "ząbków",
  "puszka", "puszki",
  "opakowanie", "opakowania",
  "plaster", "plastry",
  "sztuka", "sztuki", "szt",
  "garść", "garści",
  "pęczek", "pęczka",
  "tbsp", "tsp", "cup", "cups", "oz", "lb",
];

const UNIT_SET = new Set(UNITS.map((u) => u.toLowerCase()));

/** Vulgar fractions, so "½ szklanki" does not become item "½ szklanki". */
const FRACTION_VALUES: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/**
 * Read a leading quantity: "2", "1,5", "1.5", "½", "1½", "1 1/2", "2-3".
 * Returns the value and how much of the string it consumed.
 */
function readQuantity(text: string): { value: number | null; rest: string } {
  const trimmed = text.trimStart();

  // A range ("2-3 ziemniaki") takes the lower bound — honest and editable.
  const range = /^(\d+(?:[.,]\d+)?)\s*[-–]\s*\d+(?:[.,]\d+)?/.exec(trimmed);
  if (range) {
    return {
      value: Number(range[1].replace(",", ".")),
      rest: trimmed.slice(range[0].length),
    };
  }

  // "1 1/2" or "1/2"
  const mixed = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/.exec(trimmed);
  if (mixed) {
    const whole = mixed[1] ? Number(mixed[1]) : 0;
    const value = whole + Number(mixed[2]) / Number(mixed[3]);
    return { value, rest: trimmed.slice(mixed[0].length) };
  }

  // "1½" or "½"
  const withFraction = /^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/.exec(trimmed);
  if (withFraction) {
    const whole = withFraction[1] ? Number(withFraction[1]) : 0;
    const value = whole + FRACTION_VALUES[withFraction[2]];
    return { value, rest: trimmed.slice(withFraction[0].length) };
  }

  // Plain decimal, comma or dot.
  const plain = /^(\d+(?:[.,]\d+)?)/.exec(trimmed);
  if (plain) {
    return {
      value: Number(plain[1].replace(",", ".")),
      rest: trimmed.slice(plain[0].length),
    };
  }

  return { value: null, rest: trimmed };
}

export function parseIngredientLine(raw: string): ParsedLine {
  // Strip list bullets people paste along with the text.
  let text = raw.trim().replace(/^[-•*–—•]\s*/, "");

  /**
   * Everything after the first comma is a note: "masło, roztopione". Parenthesised
   * trailing text counts too: "cebula (drobno posiekana)".
   */
  let note: string | null = null;
  const paren = /\s*\(([^)]*)\)\s*$/.exec(text);
  if (paren) {
    note = paren[1].trim() || null;
    text = text.slice(0, paren.index).trim();
  }
  const comma = text.indexOf(",");
  // A comma inside a number ("1,5") is a decimal separator, not a note boundary.
  if (comma !== -1 && !/^\d+$/.test(text.slice(comma + 1, comma + 2))) {
    const tail = text.slice(comma + 1).trim();
    note = note ? `${tail}, ${note}` : tail || null;
    text = text.slice(0, comma).trim();
  }

  const { value: quantity, rest } = readQuantity(text);

  // The next word is a unit only if we recognise it. "2 jajka" keeps jajka as the
  // item rather than inventing a unit.
  const words = rest.trim().split(/\s+/).filter(Boolean);
  let unit: string | null = null;
  if (words.length > 1 && UNIT_SET.has(words[0].toLowerCase().replace(/\.$/, ""))) {
    unit = words.shift()!.replace(/\.$/, "");
  }

  return { quantity, unit, item: words.join(" "), note };
}

/** Split a pasted block into one parsed line per non-empty line. */
export function parseIngredientBlock(block: string): ParsedLine[] {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseIngredientLine);
}
