"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { addToShoppingListAction } from "@/app/(app)/shopping-list/actions";
import { Icon } from "@/components/icons";
import { copy } from "@openrecipe/core/copy";
import { count } from "@openrecipe/core/format";

/**
 * "Dodaj do listy zakupów" on the Recipe page. Re-adding replaces servings and
 * exclusions (ADR-0009), so when the Recipe is already on the list the button
 * says so. The Pantry Check's ticked lines are sent as exclusions.
 */
export function AddToShoppingList({
  recipeId,
  servings,
  checked,
  onList,
}: {
  recipeId: string;
  servings: number;
  checked: string[];
  onList: number | null;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"added" | "failed" | null>(null);

  function add() {
    start(async () => {
      try {
        const { ok } = await addToShoppingListAction({
          recipeId,
          servings,
          excludedLineIds: checked,
        });
        setResult(ok ? "added" : "failed");
      } catch {
        // Expired session or no network: say so rather than leave the button spinning.
        setResult("failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-input bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          <Icon name="cart" className="size-5" />
          {onList === null ? copy.shoppingList.add : copy.shoppingList.update}
        </button>
        {onList !== null && (
          <span className="rounded-input border border-line px-2 py-1 text-sm font-bold">
            {copy.shoppingList.onList}: {count(onList, copy.units.servings)}
          </span>
        )}
      </div>

      {checked.length > 0 && (
        <p className="text-sm text-muted">{copy.shoppingList.pantryNote}</p>
      )}

      {result === "added" && (
        <p role="status" className="text-sm text-accent">
          {copy.shoppingList.added}{" "}
          <Link href="/shopping-list" className="font-bold underline">
            {copy.shoppingList.open}
          </Link>
        </p>
      )}
      {result === "failed" && (
        <p role="alert" className="text-sm text-accent2">
          {copy.common.somethingFailed}
        </p>
      )}
    </div>
  );
}
