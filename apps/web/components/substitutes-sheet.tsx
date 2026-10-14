"use client";

import { useEffect, useId, useRef } from "react";

import { Icon } from "@/components/icons";
import { IngredientSprite } from "@/components/pixel-sprite";
import { copy } from "@openrecipe/core/copy";
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
  measure,
  onClose,
}: {
  line: Line | null;
  /** The line's quantity and unit at the current scale, e.g. "350 g". */
  measure: string;
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
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-5">
          <h2 id={`${id}-title`} className="font-display text-2xl uppercase tracking-tight">
            {copy.recipe.substitutes}
          </h2>

          {/*
            Reads as a swap: what the recipe asks for → what can stand in for it,
            each option with what changes if you use it. Side by side from sm up,
            stacked with a down arrow on a phone.
          */}
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)]">
            <section className="flex flex-col gap-2">
              <p className="text-sm font-extrabold uppercase tracking-wide text-muted">
                {copy.recipe.insteadOf}
              </p>
              <div className="flex items-center gap-3 rounded-input border-2 border-line bg-fill p-3">
                <SpriteTile item={line.item} />
                <p id={`${id}-item`} className="min-w-0 text-lg font-extrabold leading-snug">
                  {measure && <span className="font-mono">{measure} </span>}
                  {line.item}
                </p>
              </div>
            </section>

            <Icon
              name="swap"
              className="size-8 self-center justify-self-center text-accent2 max-sm:rotate-90 sm:mt-7"
            />

            <section className="flex flex-col gap-2">
              <p className="text-sm font-extrabold uppercase tracking-wide text-muted">
                {copy.recipe.youCanUse}
              </p>
              {line.substitutes.length === 0 ? (
                <p className="text-base text-muted">{copy.recipe.noSubstitutes}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {line.substitutes.map((substitute, index) => (
                    <li key={substitute.item} className="flex flex-col gap-2">
                      {index > 0 && (
                        <span className="self-center text-sm font-extrabold uppercase tracking-wide text-muted">
                          {copy.recipe.or}
                        </span>
                      )}
                      <div className="flex items-start gap-3 rounded-input border-2 border-line bg-surface p-3">
                        <SpriteTile item={substitute.item} />
                        <div className="min-w-0">
                          <p className="text-lg font-extrabold leading-snug">{substitute.item}</p>
                          {substitute.note && (
                            <p className="text-base leading-snug text-muted">{substitute.note}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* method="dialog" closes the thing with no handler and no state. */}
          <form method="dialog">
            <button
              type="submit"
              autoFocus
              className="min-h-11 w-full rounded-input border border-line text-base font-extrabold text-text"
            >
              {copy.common.close}
            </button>
          </form>
        </div>
      )}
    </dialog>
  );
}

/** Same light tile as the ingredient list, so the sprites read as the same things. */
function SpriteTile({ item }: { item: string }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-input border-2 border-line bg-[var(--px-w)]">
      <IngredientSprite item={item} className="size-9" />
    </span>
  );
}
