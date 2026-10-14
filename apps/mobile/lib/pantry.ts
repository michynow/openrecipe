import AsyncStorage from "@react-native-async-storage/async-storage";
import { pantryEntry, pantryKey, parsePantry, today } from "@openrecipe/core/pantry";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The Pantry Check on this device, today only (ADR-0004). Same format and key as
 * the web's localStorage; nothing goes to the server. Storage failures never
 * reach the cook: the in-memory ticks keep working.
 */
export function usePantry(recipeId: string, lineIds: string[]) {
  const [stored, setStored] = useState<string[]>([]);
  const latest = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(pantryKey(recipeId))
      .then((raw) => {
        if (!alive) return;
        // Ticks made before the read landed win over the (older) stored ones.
        const merged = [...new Set([...parsePantry(raw, today()), ...latest.current])];
        latest.current = merged;
        setStored(merged);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [recipeId]);

  // Ticks for lines that no longer exist are dropped here and gone at the next write.
  const ids = new Set(lineIds);
  const checked = stored.filter((id) => ids.has(id));

  const toggle = useCallback(
    (id: string) => {
      const next = latest.current.includes(id)
        ? latest.current.filter((other) => other !== id)
        : [...latest.current, id];
      latest.current = next;
      setStored(next);
      AsyncStorage.setItem(pantryKey(recipeId), pantryEntry(next)).catch(() => {});
    },
    [recipeId],
  );

  return { checked, toggle };
}
