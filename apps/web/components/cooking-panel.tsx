"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/icons";
import { IngredientSprite } from "@/components/pixel-sprite";
import { SubstitutesSheet } from "@/components/substitutes-sheet";
import { copy } from "@openrecipe/core/copy";
import { count } from "@openrecipe/core/format";
import {
  pantryKey,
  parsePantry,
  subscribePantry,
  today,
  writePantry,
} from "@/lib/pantry";
import { formatScaledQuantity } from "@openrecipe/core/quantity";
import type { RecipeDetail } from "@/lib/recipe-query";
import { AddToShoppingList } from "@/components/add-to-shopping-list";
import { groupSections } from "@openrecipe/core/sections";
import { buildShoppingExport } from "@openrecipe/core/shopping-export";

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
  shoppingListServings,
}: {
  shoppingListServings: number | null;
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

  const openLine = lines.find((line) => line.id === openLineId) ?? null;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3 sm:p-4">
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

      <fieldset className="flex min-w-0 flex-col gap-1">
        <legend className="pb-1 text-sm text-muted">
          {copy.recipe.pantryCheck}
        </legend>
        {groupSections(lines).map((group) => (
        <div key={group.section ?? ""} className="flex flex-col">
          {group.section && (
            <h3 className="pt-2 font-display text-lg uppercase tracking-wide">{group.section}</h3>
          )}
        <ul className="flex flex-col">
          {group.items.map(({ line }) => {
            const isChecked = checked.includes(line.id);
            const amount = formatScaledQuantity(line.quantity, factor);
            const measure = [amount, line.unit].filter(Boolean).join(" ");

            const itemStyle = isChecked ? "text-muted line-through" : "";

            return (
              <li key={line.id} className="flex items-center gap-2 border-t-2 border-line/10 text-base first:border-t-0">
                {/*
                  The whole row is the checkbox's label — tapping the item ticks it,
                  which is what a pantry check expects. Substitutes get their own
                  labelled button, and only on lines that have any: a dotted
                  underline on the item name was a hint nobody read as clickable.
                */}
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-1.5 sm:gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(line.id)}
                    /**
                     * Explicit name: the stacked fraction would otherwise read out
                     * as "1 2 ząbek". The string keeps the ½.
                     */
                    aria-label={`${measure} ${line.item}`.trim()}
                    className="size-5 shrink-0 accent-accent"
                  />
                  {/* A fixed tile, so sprites of different shapes still make one column.
                      Always light: the sprites are outlined in ink, which a dark
                      tile would swallow. */}
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-input border-2 border-line bg-[var(--px-w)] sm:size-10">
                    <IngredientSprite item={line.item} className="size-7" />
                  </span>
                  {/*
                    Number and unit are two columns from sm up: "350 g" and
                    "1 łyżeczka" right-aligned as a whole put their numbers in
                    different places. The number is right-aligned in tabular figures,
                    the unit starts on one left edge. On a phone the unit column
                    would eat the item's room, so the unit leads the item's text
                    instead — "1 | łyżeczka oliwa", the way a recipe card reads.
                  */}
                  <span className="flex shrink-0 items-baseline gap-2 self-start pt-2">
                    <span className="w-12 text-right font-mono text-lg font-bold tabular-nums sm:w-16">
                      <Amount text={amount} />
                    </span>
                    <span className="hidden w-24 text-base font-semibold sm:inline">{line.unit}</span>
                  </span>
                  <span className={`min-w-0 flex-1 py-2 font-bold hyphens-auto ${itemStyle}`}>
                    {line.unit && <span className="font-semibold sm:hidden">{line.unit} </span>}
                    {line.item}
                    {line.note && <span className="font-semibold text-muted"> ({line.note})</span>}
                  </span>
                </label>
                {line.substitutes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenLineId(line.id)}
                    aria-label={`${copy.recipe.substitutes}: ${line.item}`}
                    title={copy.recipe.substitutes}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-input border border-line px-1.5 text-sm font-extrabold text-accent2 sm:gap-1.5 sm:px-2"
                  >
                    <Icon name="swap" className="size-4 sm:size-5" />
                    <span className="hidden sm:inline">{copy.recipe.substitutes}</span>
                    <span className="font-mono tabular-nums">{line.substitutes.length}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        </div>
        ))}
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

      <AddToShoppingList
        recipeId={recipeId}
        servings={servings}
        checked={checked}
        onList={shoppingListServings}
      />

      <SubstitutesSheet
        line={openLine}
        measure={
          openLine
            ? [formatScaledQuantity(openLine.quantity, factor), openLine.unit].filter(Boolean).join(" ")
            : ""
        }
        onClose={() => setOpenLineId(null)}
      />
    </section>
  );
}

/** The vulgar-fraction glyphs lib/quantity.ts emits, as numerator/denominator. */
const FRACTIONS: Record<string, [number, number]> = {
  "⅛": [1, 8], "⅙": [1, 6], "⅕": [1, 5], "¼": [1, 4], "⅓": [1, 3],
  "⅜": [3, 8], "⅖": [2, 5], "½": [1, 2], "⅗": [3, 5], "⅝": [5, 8],
  "⅔": [2, 3], "¾": [3, 4], "⅘": [4, 5], "⅚": [5, 6], "⅞": [7, 8],
};
const FRACTION_GLYPH = /([⅛⅙⅕¼⅓⅜⅖½⅗⅝⅔¾⅘⅚⅞])/;

/**
 * A quantity with its fraction drawn as a stacked fraction — numerator over a
 * rule over denominator — rather than the Unicode glyph, which every face sets
 * at half the height of a digit. Only the display changes; the string still
 * goes to the shopping list as-is.
 */
function Amount({ text }: { text: string | null }) {
  if (!text) return null;
  return text.split(FRACTION_GLYPH).map((part, index) => {
    const fraction = FRACTIONS[part];
    if (!fraction) return part;
    return (
      <span
        key={index}
        className="ml-0.5 inline-flex flex-col items-center align-middle text-[0.82em] leading-none font-extrabold"
      >
        <span>{fraction[0]}</span>
        <span aria-hidden className="h-[2px] w-full min-w-[1.1em] rounded-full bg-current" />
        <span>{fraction[1]}</span>
      </span>
    );
  });
}
