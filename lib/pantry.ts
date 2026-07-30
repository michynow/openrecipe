/**
 * The Pantry Check: which Ingredient Lines the reader already has at home.
 *
 * Browser-only and a day old at most — see ADR-0004. Nothing here touches the
 * network or the database, so the ticks keep working in a shop with no signal.
 */

const KEY_PREFIX = "openrecipe:pantry:";

type StoredPantry = { date: string; checked: string[] };

export const pantryKey = (recipeId: string) => KEY_PREFIX + recipeId;

/**
 * Everything currently rendering a Pantry Check. `storage` only fires for *other*
 * tabs, so our own writes have to announce themselves.
 */
const listeners = new Set<() => void>();

/** For useSyncExternalStore: localStorage is the store, React just reads it. */
export function subscribePantry(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

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

export function writePantry(recipeId: string, checked: string[]): void {
  const stored: StoredPantry = { date: today(), checked };
  try {
    localStorage.setItem(pantryKey(recipeId), JSON.stringify(stored));
  } catch {
    // Storage can be full or refused outright (Safari private browsing). A tick
    // that fails to persist is a small loss; a crash mid-cook is a large one.
  }
  for (const onChange of listeners) onChange();
}
