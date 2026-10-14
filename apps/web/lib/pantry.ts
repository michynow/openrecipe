/**
 * The Pantry Check: which Ingredient Lines the reader already has at home.
 *
 * Browser-only and a day old at most — see ADR-0004. Nothing here touches the
 * network or the database, so the ticks keep working in a shop with no signal.
 */

import { pantryEntry, pantryKey } from "@openrecipe/core/pantry";

// The format (key, day stamp, parsing) is shared with the phone, in core.
export { pantryKey, parsePantry, today } from "@openrecipe/core/pantry";

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

export function writePantry(recipeId: string, checked: string[]): void {
  try {
    localStorage.setItem(pantryKey(recipeId), pantryEntry(checked));
  } catch {
    // Storage can be full or refused outright (Safari private browsing). A tick
    // that fails to persist is a small loss; a crash mid-cook is a large one.
  }
  for (const onChange of listeners) onChange();
}
