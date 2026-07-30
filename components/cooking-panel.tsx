"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { SubstitutesSheet } from "@/components/substitutes-sheet";
import { copy } from "@/lib/copy";
import { count } from "@/lib/format";
import {
  pantryKey,
  parsePantry,
  subscribePantry,
  today,
  writePantry,
} from "@/lib/pantry";
import { formatScaledQuantity } from "@/lib/quantity";
import type { RecipeDetail } from "@/lib/recipe-query";
import { buildShoppingExport } from "@/lib/shopping-export";

type Line = RecipeDetail["ingredientLines"][number];

/**
 * The ingredients, the way they are used rather than the way they are stored:
 * scaled to the servings the reader wants, ticked off against what is already in
 * the cupboard, exportable as a shopping list, and each one able to show what it
 * can be swapped for (OR-27, OR-28, OR-30, OR-33).
 *
 * All three are display state. The Recipe is never rewritten — a Recipe cooked for
 * six is still a Recipe for four (PRD §7.5), and the ticks belong to a shopping
 * trip rather than to the Recipe or to the person (ADR-0004).
 */
export function CookingPanel({
  recipeId,
  title,
  servings: storedServings,
  lines,
}: {
  recipeId: string;
  title: string;
  servings: number;
  lines: Line[];
}) {
  const [servings, setServings] = useState(storedServings);
  const [copied, setCopied] = useState(false);
  /** Which Line's Substitutes are open, by id — an id survives a re-render with
      fresh props, a captured Line object goes stale. */
  const [openLineId, setOpenLineId] = useState<string | null>(null);

  /**
   * localStorage is the store; React only reads it. The server snapshot is null
   * because the server has no pantry — so the first paint has nothing ticked, and
   * the real ticks arrive on hydration instead of tearing it.
   */
  const stored = useSyncExternalStore(
    subscribePantry,
    () => localStorage.getItem(pantryKey(recipeId)),
    () => null,
  );

  /**
   * Ticks for lines that no longer exist are dropped here and gone at the next
   * write — someone edited the Recipe between the shop and the kitchen.
   */
  const checked = useMemo(() => {
    const ids = new Set(lines.map((line) => line.id));
    return parsePantry(stored, today()).filter((id) => ids.has(id));
  }, [stored, lines]);

  const factor = servings / storedServings;

  function toggle(id: string) {
    writePantry(
      recipeId,
      checked.includes(id)
        ? checked.filter((other) => other !== id)
        : [...checked, id],
    );
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const exportText = () =>
    buildShoppingExport({ title, servings, factor, lines, checked });

  async function share() {
    const text = exportText();
    // No share sheet on most desktops; the clipboard is the fallback there.
    if (typeof navigator.share !== "function") return copyToClipboard(text);
    // Dismissing the sheet rejects. That is a change of mind, not a failure.
    await navigator.share({ text }).catch(() => {});
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl uppercase tracking-tight">
        {copy.recipe.ingredients}
      </h2>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">{copy.recipe.servings}</span>
        <button
          type="button"
          onClick={() => setServings((n) => Math.max(1, n - 1))}
          disabled={servings <= 1}
          aria-label={copy.recipe.fewerServings}
          className="size-11 rounded-input border border-line text-lg text-muted disabled:opacity-30"
        >
          −
        </button>
        {/* Announced on change, so the stepper is usable without watching it. */}
        <span aria-live="polite" className="min-w-24 text-center font-mono">
          {count(servings, copy.units.servings)}
        </span>
        <button
          type="button"
          onClick={() => setServings((n) => n + 1)}
          aria-label={copy.recipe.moreServings}
          className="size-11 rounded-input border border-line text-lg text-muted"
        >
          +
        </button>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="pb-1 text-sm text-muted">
          {copy.recipe.pantryCheck}
        </legend>
        <ul className="flex flex-col">
          {lines.map((line) => {
            const isChecked = checked.includes(line.id);
            const measure = [
              formatScaledQuantity(line.quantity, factor),
              line.unit,
            ]
              .filter(Boolean)
              .join(" ");

            /**
             * The dotted underline is the only hint that an item is worth tapping,
             * so it goes on the lines that actually have Substitutes. Ticked lines
             * get the strike instead — the two are text decorations and cannot both
             * apply, and a line already in the cupboard is not the one you are
             * looking to replace.
             */
            const itemStyle = isChecked
              ? "text-muted line-through"
              : line.substitutes.length > 0
                ? "underline decoration-accent decoration-dotted underline-offset-4"
                : "";

            return (
              <li key={line.id} className="flex items-center gap-2 text-sm">
                {/*
                  Two tap targets side by side, not one stacked on the other. The row
                  used to be a single label, so anything that opened the Substitutes
                  sheet would have ticked the line on the way — the item text is the
                  sheet's trigger, so it has to sit *outside* the label rather than
                  inside it with a click handler wrestling the checkbox for the same
                  pixels. The label keeps the checkbox and the measure column, the
                  button takes the rest of the row, and both stay 44px tall for
                  greasy hands.
                */}
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(line.id)}
                    /**
                     * Explicit name, and now load-bearing: the item moved out of the
                     * label to become the sheet's trigger, so the label is a bare
                     * measure and every tick would otherwise announce as "2 tbsp".
                     */
                    aria-label={`${measure} ${line.item}`.trim()}
                    className="size-5 shrink-0 accent-accent"
                  />
                  {/*
                    Quantity and unit in mono and right-aligned in a fixed column, so
                    numbers line up down the list instead of ragging with the words.
                  */}
                  <span className="w-24 shrink-0 text-right font-mono text-muted">
                    {measure}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setOpenLineId(line.id)}
                  /* The visible text is the item, which says nothing about what the
                     tap does; the name has to. */
                  aria-label={`${copy.recipe.substitutes}: ${line.item}`}
                  className={`min-h-11 flex-1 text-left ${itemStyle}`}
                >
                  {line.item}
                  {line.note && <span className="text-muted"> ({line.note})</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={share}
          className="min-h-11 rounded-input bg-accent px-4 text-sm font-medium text-accent-ink"
        >
          {copy.recipe.export}
        </button>
        <button
          type="button"
          onClick={() => copyToClipboard(exportText())}
          className="min-h-11 rounded-input border border-line px-4 text-sm text-muted transition-colors hover:text-text"
        >
          {copy.recipe.copy}
        </button>
        {copied && (
          <p role="status" className="text-sm text-accent">
            {copy.recipe.copied}
          </p>
        )}
      </div>

      <SubstitutesSheet
        line={lines.find((line) => line.id === openLineId) ?? null}
        onClose={() => setOpenLineId(null)}
      />
    </section>
  );
}
