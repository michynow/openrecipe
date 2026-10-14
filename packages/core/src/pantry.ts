/**
 * The Pantry Check's storage format: which Ingredient Lines the reader already
 * has at home, for today only (ADR-0004). Pure, so the web (localStorage, see
 * apps/web/lib/pantry.ts) and the phone (AsyncStorage) read and write the same
 * shape under the same key.
 */

const KEY_PREFIX = "openrecipe:pantry:";

export type StoredPantry = { date: string; checked: string[] };

export const pantryKey = (recipeId: string) => KEY_PREFIX + recipeId;

/**
 * The local calendar day, "2026-07-27".
 *
 * sv-SE because its locale format happens to be the ISO one; `toISOString` would
 * give the UTC day, which in Poland rolls over two hours early and would wipe a
 * late-evening shopping list before the shopping happened.
 */
export function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/**
 * The ticks in a stored entry — or nothing at all when the entry is from another
 * day, or is not the shape we wrote. Yesterday's shopping trip is over, and a
 * half-parsed one is worse than a clean list.
 */
export function parsePantry(raw: string | null, day: string): string[] {
  if (!raw) return [];
  try {
    const stored = JSON.parse(raw) as StoredPantry | null;
    if (stored?.date !== day || !Array.isArray(stored.checked)) return [];
    return stored.checked.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
}

/** What to store for these ticks: stamped with today, so tomorrow reads as empty. */
export function pantryEntry(checked: string[]): string {
  const stored: StoredPantry = { date: today(), checked };
  return JSON.stringify(stored);
}
