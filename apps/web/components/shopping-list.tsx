"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import {
  clearShoppingListAction,
  removeFromShoppingListAction,
  setShoppingListServingsAction,
  tickShoppingItemAction,
} from "@/app/(app)/shopping-list/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { IngredientSprite } from "@/components/pixel-sprite";
import { RowButton, SectionCard } from "@/components/section-card";
import type { ShoppingListResult } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { count } from "@openrecipe/core/format";
import {
  buildShoppingListText,
  rowAmount,
  withTick,
  type ShoppingList as List,
} from "@openrecipe/core/shopping-list";

const btn =
  "min-h-11 rounded-input border border-line px-4 text-sm text-muted transition-colors hover:text-text disabled:opacity-40";

/**
 * The household Shopping List screen. Every action answers with the fresh list,
 * which replaces the state — a refused one rolls back by itself, because the list
 * it returns is the truth. One that throws (expired session, network) restores
 * the list from before its optimistic change. Answers can land out of order, so
 * only the latest action's answer is applied.
 */
export function ShoppingList({ initial }: { initial: List }) {
  const [list, setList] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef(0);

  function run(action: () => Promise<ShoppingListResult>, optimistic?: List) {
    const seq = ++latest.current;
    const before = list;
    if (optimistic) setList(optimistic);
    start(async () => {
      try {
        const { ok, list: next } = await action();
        if (seq !== latest.current) return;
        setList(next);
        setNotice(ok ? null : copy.common.somethingFailed);
      } catch {
        if (seq !== latest.current) return;
        setList(before);
        setNotice(copy.common.somethingFailed);
      }
    });
  }

  function tick(row: List["groups"][number]["rows"][number]) {
    const ticked = !row.ticked;
    run(() => tickShoppingItemAction({ key: row.key, ticked }), withTick(list, row.key, ticked));
  }

  async function share() {
    const text = buildShoppingListText(list);
    // No share sheet on most desktops; the clipboard is the fallback there.
    if (typeof navigator.share !== "function") {
      await navigator.clipboard.writeText(text);
      setNotice(copy.recipe.copied);
      setTimeout(() => setNotice(null), 2000);
      return;
    }
    // Dismissing the sheet rejects: a change of mind, not a failure.
    await navigator.share({ text }).catch(() => {});
  }

  if (list.recipes.length === 0 && list.groups.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line p-6 text-center text-muted">
        {copy.shoppingList.empty}
      </p>
    );
  }

  const rows = list.groups.flatMap((g) => g.rows);
  const anyTicked = rows.some((r) => r.ticked);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard number="01" icon="cart" label={copy.shoppingList.items}>
        <ul className="flex flex-col">
          {list.groups.map((group) => (
            <li
              key={group.item}
              className="flex flex-col gap-1 border-t-2 border-line/10 py-2 first:border-t-0"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-input border-2 border-line bg-[var(--px-w)]">
                  <IngredientSprite item={group.item} className="size-7" />
                </span>
                <span className="font-display text-lg uppercase tracking-wide">{group.item}</span>
              </div>
              <ul className="flex flex-col">
                {group.rows.map((row) => (
                  <li key={row.key} className="flex flex-col">
                    <label
                      className={`flex min-h-11 cursor-pointer items-center gap-2 ${
                        row.ticked ? "text-muted line-through" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={row.ticked}
                        onChange={() => tick(row)}
                        aria-label={`${row.ticked ? copy.shoppingList.untick : copy.shoppingList.tick}: ${rowAmount(row)} ${group.item}`}
                        className="size-5 shrink-0 accent-accent"
                      />
                      <span className="font-mono font-bold tabular-nums">{rowAmount(row)}</span>
                    </label>
                    <p className="pl-7 text-sm text-muted">
                      {copy.shoppingList.from}{" "}
                      {row.sources.map((source, i) => (
                        <span key={source.recipeId}>
                          {i > 0 && ", "}
                          <Link href={`/recipes/${source.slug}`} className="underline">
                            {source.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {rows.length > 0 && !rows.some((r) => !r.ticked) && (
          <p role="status" className="text-sm font-bold text-accent">
            {copy.shoppingList.allTicked}
          </p>
        )}
      </SectionCard>

      <SectionCard number="02" icon="ingredients" label={copy.shoppingList.recipes}>
        <ul className="flex flex-col">
          {list.recipes.map((recipe) => (
            <li
              key={recipe.recipeId}
              className="flex flex-wrap items-center gap-2 border-t-2 border-line/10 py-1 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/recipes/${recipe.slug}`} className="font-bold underline">
                  {recipe.title}
                </Link>
                {recipe.skipped > 0 && (
                  <span className="text-sm text-muted">
                    {" · "}
                    {copy.shoppingList.skipped(recipe.skipped)}
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-label={copy.recipe.fewerServings}
                disabled={recipe.servings <= 1 || pending}
                onClick={() =>
                  run(() => setShoppingListServingsAction(recipe.recipeId, recipe.servings - 1))
                }
                className="size-11 rounded-input border border-line text-lg text-muted disabled:opacity-30"
              >
                −
              </button>
              <span aria-live="polite" className="min-w-24 text-center font-mono">
                {count(recipe.servings, copy.units.servings)}
              </span>
              <button
                type="button"
                aria-label={copy.recipe.moreServings}
                disabled={recipe.servings >= 99 || pending}
                onClick={() =>
                  run(() => setShoppingListServingsAction(recipe.recipeId, recipe.servings + 1))
                }
                className="size-11 rounded-input border border-line text-lg text-muted disabled:opacity-30"
              >
                +
              </button>
              <RowButton
                icon="remove"
                label={`${copy.shoppingList.remove}: ${recipe.title}`}
                onClick={() => run(() => removeFromShoppingListAction(recipe.recipeId))}
                destructive
              />
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={share}
          className="min-h-11 rounded-input bg-accent px-4 text-sm font-medium text-accent-ink"
        >
          {copy.shoppingList.share}
        </button>
        <button
          type="button"
          disabled={!anyTicked || pending}
          onClick={() => run(() => clearShoppingListAction("ticked"))}
          className={btn}
        >
          {copy.shoppingList.clearTicked}
        </button>
        <form action={() => run(() => clearShoppingListAction("all"))}>
          <ConfirmButton
            message={copy.shoppingList.clearAllConfirm}
            disabled={pending}
            className={btn}
          >
            {copy.shoppingList.clearAll}
          </ConfirmButton>
        </form>
        {notice && (
          <p role="status" className="text-sm text-accent">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
