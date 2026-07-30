"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

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
 * the cupboard, and exportable as a shopping list (OR-27, OR-28, OR-30).
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

            return (
              <li key={line.id}>
                {/* The whole row is the tap target: 44px tall, thumb-sized, greasy hands. */}
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(line.id)}
                    /**
                     * Explicit name: a wrapping label ought to name the input, but
                     * the row is three spans and the computed name is not worth
                     * gambling on when every line would announce alike.
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
                  <span className={isChecked ? "text-muted line-through" : undefined}>
                    {line.item}
                    {line.note && <span className="text-muted"> ({line.note})</span>}
                  </span>
                </label>
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
    </section>
  );
}
