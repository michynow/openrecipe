"use client";

import { useEffect, useId, useRef } from "react";

import { copy } from "@/lib/copy";
import type { RecipeDetail } from "@/lib/recipe-query";

type Line = RecipeDetail["ingredientLines"][number];

/**
 * The stored Substitutes for one Ingredient Line, in a sheet (OR-33).
 *
 * Everything shown here already arrived with the page — the Substitutes sit on the
 * `ingredient_line` row and are read straight off it. Nothing is fetched and nothing
 * is generated, because nothing here *can* be: the deployed app holds no model
 * credentials, so the Worker precomputes Substitutes at import time (ADR-0002).
 * A hand-typed Recipe therefore has none, and that is a normal state rather than a
 * failure — hence a sentence explaining where they come from instead of an empty list.
 *
 * Native `<dialog>` with `showModal()`, the same as delete-recipe-dialog.tsx: the
 * focus trap, Escape, the top layer and returning focus to the trigger are the
 * platform's job. One sheet serves the whole list — the parent says which Line is
 * open, so there is one dialog on the page rather than one per row.
 */
export function SubstitutesSheet({
  line,
  onClose,
}: {
  line: Line | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  /** `showModal()` is imperative; there is no prop that means "in the top layer". */
  useEffect(() => {
    if (line) dialog.current?.showModal();
    else dialog.current?.close();
  }, [line]);

  return (
    <dialog
      ref={dialog}
      /* Escape, the close button and a backdrop tap all land here, so the parent
         only ever has to hear about closing once. */
      onClose={onClose}
      /**
       * A press that lands on the dialog element itself landed on ::backdrop —
       * the content is a child, so anything inside it targets that child instead.
       * pointerdown rather than click because Safari on iOS is unreliable about
       * bubbling clicks from elements that are not interactive, and a backdrop is
       * as non-interactive as an element gets.
       */
      onPointerDown={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
      aria-labelledby={`${id}-title ${id}-item`}
      className="mx-0 mb-0 mt-auto w-full max-w-none rounded-t-card border-t border-line bg-surface p-0 text-text backdrop:bg-bg/80"
    >
      {line && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-5">
          <h2
            id={`${id}-title`}
            className="font-display text-lg uppercase tracking-tight"
          >
            {copy.recipe.substitutes}
          </h2>
          <p id={`${id}-item`} className="text-sm text-muted">
            {line.item}
          </p>

          {line.substitutes.length === 0 ? (
            <p className="text-sm text-muted">{copy.recipe.noSubstitutes}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {line.substitutes.map((substitute) => (
                <li key={substitute.item}>
                  {substitute.item}
                  {substitute.note && (
                    <span className="text-muted"> ({substitute.note})</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* method="dialog" closes the thing with no handler and no state. */}
          <form method="dialog">
            <button
              type="submit"
              className="min-h-11 w-full rounded-input border border-line text-sm text-muted"
            >
              {copy.common.close}
            </button>
          </form>
        </div>
      )}
    </dialog>
  );
}
