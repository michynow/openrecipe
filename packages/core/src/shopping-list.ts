import { copy } from "./copy.ts";
import { count } from "./format.ts";
import { formatScaledQuantity } from "./quantity.ts";

/**
 * The household Shopping List (ADR-0009): several Recipes, each at a chosen
 * serving count, merged into one list of Shopping List Items.
 *
 * Pure, and the server runs it: the API hands the phone the merged list, so the
 * two clients cannot merge differently. The text export runs on either side.
 */

/** Item text for matching: trimmed, lower-cased, spaces collapsed. Diacritics stay. */
export const normalizeItem = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The merge key of the row a line lands in, also what ticks and exclusions are
 * stored under. A quantity-less line ("do smaku") goes to the item's one
 * unquantified row whatever its unit.
 */
export function rowKey(line: { item: string; unit: string | null; quantity: number | null }): string {
  const unit = line.quantity === null ? "~" : `=${normalizeItem(line.unit ?? "")}`;
  return `${normalizeItem(line.item)}|${unit}`;
}

/** One Recipe on the list, with its live lines, as the server reads it. */
export type ShoppingListSource = {
  recipeId: string;
  slug: string;
  title: string;
  /** The chosen serving count. */
  servings: number;
  /** The Recipe's own Servings — what the stored quantities produce. */
  baseServings: number;
  /** Row keys left off: Pantry Check ticks at add time, and cleared ticked rows. */
  excluded: readonly string[];
  lines: readonly { quantity: number | null; unit: string | null; item: string }[];
};

/** A tick, with the quantity that was on screen when it was made. */
export type ShoppingListTick = { key: string; quantity: number | null };

export type ShoppingListRecipe = {
  recipeId: string;
  slug: string;
  title: string;
  servings: number;
  baseServings: number;
  /** How many of its lines are left off the list. */
  skipped: number;
};

export type ShoppingListItem = {
  /** Send this back to tick or untick. */
  key: string;
  unit: string | null;
  /** Summed and scaled; null = "do smaku". Display with formatScaledQuantity(q, 1). */
  quantity: number | null;
  ticked: boolean;
  /** The Recipes this row came from, in list order. */
  sources: { recipeId: string; slug: string; title: string }[];
};

/** One product: every row of the same item, one per unit. */
export type ShoppingListGroup = { item: string; rows: ShoppingListItem[] };

export type ShoppingList = { recipes: ShoppingListRecipe[]; groups: ShoppingListGroup[] };

/** Float sums of scaled fractions drift; a tick of 1.4999999 still covers 1.5. */
const EPSILON = 1e-6;

/**
 * Merge the Recipes into product groups, in first-appearance order.
 *
 * A row is ticked while its tick covers it: a tick on a quantity-less row always
 * does; otherwise the ticked quantity must be at least what is needed now, so
 * adding a Recipe that needs more of a bought item un-ticks it.
 */
export function mergeShoppingList(
  sources: readonly ShoppingListSource[],
  ticks: readonly ShoppingListTick[],
): ShoppingList {
  const tickBy = new Map(ticks.map((tick) => [tick.key, tick]));
  const groups = new Map<string, ShoppingListGroup>();
  const rows = new Map<string, ShoppingListItem>();

  const recipes = sources.map((source) => {
    const factor = source.servings / source.baseServings;
    const excluded = new Set(source.excluded);
    const ref = { recipeId: source.recipeId, slug: source.slug, title: source.title };
    let skipped = 0;

    for (const line of source.lines) {
      const key = rowKey(line);
      if (excluded.has(key)) {
        skipped++;
        continue;
      }

      const item = normalizeItem(line.item);
      let group = groups.get(item);
      if (!group) {
        group = { item: line.item.trim().replace(/\s+/g, " "), rows: [] };
        groups.set(item, group);
      }

      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          unit: line.quantity === null ? null : line.unit?.trim() || null,
          quantity: line.quantity === null ? null : 0,
          ticked: false,
          sources: [],
        };
        rows.set(key, row);
        group.rows.push(row);
      }

      if (row.quantity !== null && line.quantity !== null) row.quantity += line.quantity * factor;
      if (!row.sources.some((s) => s.recipeId === ref.recipeId)) row.sources.push(ref);
    }

    return {
      recipeId: source.recipeId,
      slug: source.slug,
      title: source.title,
      servings: source.servings,
      baseServings: source.baseServings,
      skipped,
    };
  });

  for (const row of rows.values()) {
    const tick = tickBy.get(row.key);
    row.ticked =
      tick !== undefined &&
      (row.quantity === null || (tick.quantity !== null && tick.quantity >= row.quantity - EPSILON));
  }

  return { recipes, groups: [...groups.values()] };
}

/**
 * The list as plain text, in the Shopping Export's style: a header, the
 * unticked rows as bullets, a count of what is already in the basket, and the
 * Recipes it is for.
 */
export function buildShoppingListText(list: ShoppingList): string {
  const header = `${copy.shoppingList.title} — ${count(list.recipes.length, copy.units.recipes)}`;
  const rows = list.groups.flatMap((group) => group.rows.map((row) => ({ group, row })));
  const wanted = rows.filter(({ row }) => !row.ticked);

  const footer = list.recipes
    .map((recipe) => `${recipe.title} (${count(recipe.servings, copy.units.servings)})`)
    .join(", ");
  const forWhat = footer ? `\n\n${copy.shoppingList.forRecipes} ${footer}` : "";

  if (rows.length === 0) return `${header}\n\n${copy.shoppingList.empty}`;
  if (wanted.length === 0) return `${header}\n\n${copy.shoppingList.allTicked}${forWhat}`;

  const bullets = wanted
    .map(
      ({ group, row }) =>
        `• ${[formatScaledQuantity(row.quantity, 1), row.unit, group.item].filter(Boolean).join(" ")}`,
    )
    .join("\n");

  const done = rows.length - wanted.length;
  const basket = done ? `\n\n${copy.shoppingList.inBasket(done, rows.length)}` : "";

  return `${header}\n\n${bullets}${basket}${forWhat}`;
}

/** The list with one row's tick flipped — the optimistic update both clients show. */
export function withTick(list: ShoppingList, key: string, ticked: boolean): ShoppingList {
  return {
    ...list,
    groups: list.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => (row.key === key ? { ...row, ticked } : row)),
    })),
  };
}

/** A row's amount as shown: "450 ml", "2", or "do smaku". */
export const rowAmount = (row: Pick<ShoppingListItem, "quantity" | "unit">): string =>
  row.quantity === null
    ? copy.shoppingList.toTaste
    : [formatScaledQuantity(row.quantity, 1), row.unit].filter(Boolean).join(" ");
