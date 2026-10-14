"use client";

import { useEffect, useRef, useState } from "react";

import {
  logCookedAction,
  undoCookedAction,
} from "@/app/(app)/recipes/actions";
import { copy } from "@openrecipe/core/copy";
import { count, formatDate } from "@openrecipe/core/format";

/**
 * "I made this" — writes a Cook Log entry (OR-32).
 *
 * Optimistic: the count moves on the tap, not on the response, because this button
 * gets pressed with greasy hands in a kitchen with one bar of signal. A failure
 * puts the count back where it was and says so.
 *
 * The summary comes in as props rather than being fetched here, so the page stays
 * server-rendered and this component owns nothing but the one entry it just made.
 */

/** How long the undo stays on offer. Long enough to notice the mistake. */
const UNDO_WINDOW_MS = 8_000;

export function CookLogButton({
  recipeId,
  times,
  lastCookedAt,
}: {
  recipeId: string;
  times: number;
  lastCookedAt: Date | null;
}) {
  /** The entry made in this page view. `id` is empty until the server answers. */
  const [entry, setEntry] = useState<{ id: string; cookedAt: Date } | null>(
    null,
  );
  const [canUndo, setCanUndo] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  // The props are the server's count; the entry made here is added on top of it.
  const shownTimes = times + (entry ? 1 : 0);
  const shownLast = entry?.cookedAt ?? lastCookedAt;

  async function log() {
    setPending(true);
    setFailed(false);
    const optimistic = { id: "", cookedAt: new Date() };
    setEntry(optimistic);

    try {
      const { entryId } = await logCookedAction(recipeId);
      setEntry({ ...optimistic, id: entryId });
      setCanUndo(true);
      undoTimer.current = setTimeout(
        () => setCanUndo(false),
        UNDO_WINDOW_MS,
      );
    } catch {
      // Roll the count back to what the server last told us, and say what happened.
      setEntry(null);
      setCanUndo(false);
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  async function undo() {
    if (!entry?.id) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPending(true);

    try {
      await undoCookedAction(entry.id);
      setEntry(null);
      setCanUndo(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={log}
        /**
         * Logging twice in one day is allowed, but not twice in one tap. The button
         * stays disabled for the rest of the page view once an entry lands — a
         * second helping tomorrow is a fresh visit, an impatient double-tap is not.
         */
        disabled={pending || entry !== null}
        className="rounded-input bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-50"
      >
        {copy.recipe.cooked}
      </button>

      {/* Nothing at all before the first time it is cooked. */}
      {shownTimes > 0 && (
        <p className="text-sm text-muted">
          <span className="font-mono">
            {count(shownTimes, copy.units.times)}
          </span>
          {shownLast && <span> · {formatDate(shownLast)}</span>}
        </p>
      )}

      {canUndo && (
        <p role="status" className="text-sm">
          {copy.recipe.cookedConfirmed}{" "}
          <button
            type="button"
            onClick={undo}
            disabled={pending}
            className="text-accent underline disabled:opacity-50"
          >
            {copy.common.undo}
          </button>
        </p>
      )}

      {failed && (
        <p role="alert" className="text-sm text-accent2">
          {copy.common.somethingFailed}
        </p>
      )}
    </div>
  );
}
