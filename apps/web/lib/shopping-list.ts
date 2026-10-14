import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "./db/index.ts";
import { ingredientLine, recipe, shoppingListEntry, shoppingListTick } from "./db/schema.ts";
import {
  mergeShoppingList,
  rowKey,
  type ShoppingList,
  type ShoppingListSource,
} from "@openrecipe/core/shopping-list";

/**
 * The household Shopping List (ADR-0009). One list, shared; any signed-in user
 * may change it — the callers check for a session, never for Admin.
 *
 * Reads merge in core (`mergeShoppingList`) so the web and the phone get the
 * same rows. Every mutation returns the fresh list: the UI renders the answer
 * instead of refetching.
 */

const toNumber = (value: string | null) => (value === null ? null : Number(value));

export async function getShoppingList(): Promise<ShoppingList> {
  const [entries, ticks] = await Promise.all([
    db
      .select({
        recipeId: recipe.id,
        slug: recipe.slug,
        title: recipe.title,
        baseServings: recipe.servings,
        servings: shoppingListEntry.servings,
        excluded: shoppingListEntry.excluded,
      })
      .from(shoppingListEntry)
      // Soft-deleted Recipes drop off the list; their rows go with the cascade.
      .innerJoin(recipe, and(eq(recipe.id, shoppingListEntry.recipeId), isNull(recipe.deletedAt)))
      .orderBy(asc(shoppingListEntry.addedAt), asc(shoppingListEntry.id)),
    db.select({ key: shoppingListTick.key, quantity: shoppingListTick.quantity }).from(shoppingListTick),
  ]);

  const lines =
    entries.length === 0
      ? []
      : await db
          .select({
            recipeId: ingredientLine.recipeId,
            quantity: ingredientLine.quantity,
            unit: ingredientLine.unit,
            item: ingredientLine.item,
          })
          .from(ingredientLine)
          .where(inArray(ingredientLine.recipeId, entries.map((e) => e.recipeId)))
          .orderBy(asc(ingredientLine.position));

  const sources: ShoppingListSource[] = entries.map((entry) => ({
    ...entry,
    lines: lines
      .filter((line) => line.recipeId === entry.recipeId)
      .map((line) => ({ ...line, quantity: toNumber(line.quantity) })),
  }));

  return mergeShoppingList(
    sources,
    ticks.map((tick) => ({ key: tick.key, quantity: toNumber(tick.quantity) })),
  );
}

/** The servings this Recipe is on the list at, or null — for the Recipe page. */
export async function getShoppingListServings(recipeId: string): Promise<number | null> {
  const [row] = await db
    .select({ servings: shoppingListEntry.servings })
    .from(shoppingListEntry)
    .where(eq(shoppingListEntry.recipeId, recipeId))
    .limit(1);
  return row?.servings ?? null;
}


/**
 * Put a Recipe on the list, or replace its servings and exclusions.
 *
 * `excludedLineIds` are the lines ticked in the device's Pantry Check. They are
 * turned into row keys now, while the ids are still the Recipe's — a later save
 * replaces the lines and their ids (ADR-0009). Ids that are not this Recipe's
 * lines are ignored. False when there is no live Recipe with that id.
 */
export async function addToShoppingList(
  recipeId: string,
  servings: number,
  excludedLineIds: readonly string[],
  userId: string,
): Promise<boolean> {
  const [live] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), isNull(recipe.deletedAt)))
    .limit(1);
  if (!live) return false;

  const ticked =
    excludedLineIds.length === 0
      ? []
      : await db
          .select({ quantity: ingredientLine.quantity, unit: ingredientLine.unit, item: ingredientLine.item })
          .from(ingredientLine)
          .where(and(eq(ingredientLine.recipeId, recipeId), inArray(ingredientLine.id, [...excludedLineIds])));

  const excluded = [...new Set(ticked.map((line) => rowKey({ ...line, quantity: toNumber(line.quantity) })))];

  await db
    .insert(shoppingListEntry)
    .values({ recipeId, servings, excluded, addedById: userId })
    .onConflictDoUpdate({
      target: shoppingListEntry.recipeId,
      set: { servings, excluded, addedById: userId, addedAt: new Date() },
    });

  return true;
}

/** False when the Recipe is not on the list. */
export async function setShoppingListServings(recipeId: string, servings: number): Promise<boolean> {
  const rows = await db
    .update(shoppingListEntry)
    .set({ servings })
    .where(eq(shoppingListEntry.recipeId, recipeId))
    .returning({ id: shoppingListEntry.id });
  return rows.length > 0;
}

/** False when it was not on the list. */
export async function removeFromShoppingList(recipeId: string): Promise<boolean> {
  const rows = await db
    .delete(shoppingListEntry)
    .where(eq(shoppingListEntry.recipeId, recipeId))
    .returning({ id: shoppingListEntry.id });
  return rows.length > 0;
}

/**
 * Tick or untick a Shopping List Item. `quantity` is what the row showed —
 * the tick holds until the list needs more than that. Last write wins.
 */
export async function tickShoppingItem(
  key: string,
  quantity: number | null,
  ticked: boolean,
  userId: string,
): Promise<void> {
  if (!ticked) {
    await db.delete(shoppingListTick).where(eq(shoppingListTick.key, key));
    return;
  }

  const value = { quantity: quantity === null ? null : String(quantity), tickedById: userId, tickedAt: new Date() };
  await db
    .insert(shoppingListTick)
    .values({ key, ...value })
    .onConflictDoUpdate({ target: shoppingListTick.key, set: value });
}

/**
 * "Wyczyść odhaczone": every ticked row leaves the list — its key joins the
 * `excluded` of each Recipe it came from — and the ticks go. "all" empties both
 * tables. One batch, so a half-cleared list cannot happen.
 */
export async function clearShoppingList(scope: "ticked" | "all"): Promise<void> {
  if (scope === "all") {
    await runAtomically([db.delete(shoppingListEntry), db.delete(shoppingListTick)]);
    return;
  }

  const list = await getShoppingList();
  const done = list.groups.flatMap((group) => group.rows.filter((row) => row.ticked));
  if (done.length === 0) return;

  const byRecipe = new Map<string, string[]>();
  for (const row of done) {
    for (const source of row.sources) {
      byRecipe.set(source.recipeId, [...(byRecipe.get(source.recipeId) ?? []), row.key]);
    }
  }

  const entries = await db
    .select({ recipeId: shoppingListEntry.recipeId, excluded: shoppingListEntry.excluded })
    .from(shoppingListEntry)
    .where(inArray(shoppingListEntry.recipeId, [...byRecipe.keys()]));

  await runAtomically([
    ...entries.map((entry) =>
      db
        .update(shoppingListEntry)
        .set({ excluded: [...new Set([...entry.excluded, ...(byRecipe.get(entry.recipeId) ?? [])])] })
        .where(eq(shoppingListEntry.recipeId, entry.recipeId)),
    ),
    db.delete(shoppingListTick).where(inArray(shoppingListTick.key, done.map((row) => row.key))),
  ]);
}

/** Neon HTTP has no transactions; a batch is one server-side transaction. See lib/recipes.ts. */
async function runAtomically(statements: unknown[]): Promise<void> {
  await (db as unknown as { batch: (s: unknown[]) => Promise<unknown> }).batch(statements);
}
