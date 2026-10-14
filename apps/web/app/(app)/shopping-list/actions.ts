"use server";

import type { ShoppingListResult } from "@openrecipe/core/api";
import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  addToShoppingList,
  clearShoppingList,
  getShoppingList,
  removeFromShoppingList,
  setShoppingListServings,
  tickShoppingItem,
} from "@/lib/shopping-list";
import { shoppingListSchemas as s } from "@/lib/shopping-list-schemas";

/**
 * Server Actions for the household Shopping List (ADR-0009).
 *
 * `requireUser`, not `requireAdmin`: Members use the list too — it is household
 * logistics, not library content. Inputs are parsed with the same schemas the
 * /api/v1 handlers use; a Server Action is a public POST endpoint. A malformed
 * input answers `ok: false` with the current list rather than throwing, so the
 * screen re-renders the truth instead of an error page.
 */

/** The list, and every Recipe page — each shows whether it is on the list. */
async function done(ok: boolean): Promise<ShoppingListResult> {
  revalidatePath("/shopping-list");
  revalidatePath("/recipes/[slug]", "page");
  return { ok, list: await getShoppingList() };
}

/** From the Recipe page. `excludedLineIds`: the Pantry Check's ticked lines. */
export async function addToShoppingListAction(input: {
  recipeId: string;
  servings: number;
  excludedLineIds?: string[];
}): Promise<ShoppingListResult> {
  const user = await requireUser();
  const parsed = s.add.safeParse(input);
  if (!parsed.success) return done(false);

  const { recipeId, servings, excludedLineIds } = parsed.data;
  const ok = await addToShoppingList(recipeId, servings, excludedLineIds, user.id);
  return done(ok);
}

export async function setShoppingListServingsAction(
  recipeId: string,
  servings: number,
): Promise<ShoppingListResult> {
  await requireUser();
  const parsed = s.servings.safeParse({ servings });
  if (!isUuid(recipeId) || !parsed.success) return done(false);
  return done(await setShoppingListServings(recipeId, parsed.data.servings));
}

export async function removeFromShoppingListAction(recipeId: string): Promise<ShoppingListResult> {
  await requireUser();
  if (!isUuid(recipeId)) return done(false);
  return done(await removeFromShoppingList(recipeId));
}

export async function tickShoppingItemAction(input: { key: string; ticked: boolean }): Promise<ShoppingListResult> {
  const user = await requireUser();
  const parsed = s.tick.safeParse(input);
  if (!parsed.success) return done(false);

  return done(await tickShoppingItem(parsed.data.key, parsed.data.ticked, user.id));
}

export async function clearShoppingListAction(scope: "ticked" | "all"): Promise<ShoppingListResult> {
  await requireUser();
  const parsed = s.clear.safeParse({ scope });
  if (!parsed.success) return done(false);

  await clearShoppingList(parsed.data.scope);
  return done(true);
}
