import type { RecipeFormValue } from "../recipe-schema.ts";

/**
 * Comparing a re-imported Draft against the Recipe it came from (OR-46).
 *
 * The point is protecting hand corrections. Somebody fixed a mistranslated
 * ingredient six months ago; a re-import must not quietly undo that. So the diff
 * is offered rather than applied: every difference is a thing you can pull in,
 * and doing nothing keeps what you already had.
 */

export type DiffField =
  | "title"
  | "servings"
  | "totalMinutes"
  | "kcalPerServing"
  | "imageUrl"
  | "steps"
  | "tips"
  | "tagSlugs"
  | "ingredientLines";

export type Difference = {
  field: DiffField;
  /** What the Recipe says now, rendered for a human. */
  current: string;
  /** What the re-import proposes. */
  incoming: string;
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(" · ");
  return String(value);
};

/** Ingredient lines as one comparable line each: "2 łyżki masła (roztopione)". */
export function lineText(line: RecipeFormValue["ingredientLines"][number]): string {
  const parts = [
    line.quantity === null ? null : String(line.quantity),
    line.unit,
    line.item,
  ].filter(Boolean);

  return line.note ? `${parts.join(" ")} (${line.note})` : parts.join(" ");
}

/** Matching key for an Ingredient Line. Case and spacing are not a difference. */
const keyOf = (line: RecipeFormValue["ingredientLines"][number]) =>
  line.item.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Ingredient Lines, compared by item rather than by position.
 *
 * Position would report every line after an inserted one as changed, which is
 * the failure that makes a diff useless — the reader stops reading it. Matching
 * on the item name means an inserted line shows up as exactly one addition.
 */
export function diffIngredientLines(
  current: RecipeFormValue["ingredientLines"],
  incoming: RecipeFormValue["ingredientLines"],
): { added: string[]; removed: string[]; changed: { from: string; to: string }[] } {
  const currentByKey = new Map(current.map((line) => [keyOf(line), line]));
  const incomingByKey = new Map(incoming.map((line) => [keyOf(line), line]));

  const added = incoming
    .filter((line) => !currentByKey.has(keyOf(line)))
    .map(lineText);

  const removed = current
    .filter((line) => !incomingByKey.has(keyOf(line)))
    .map(lineText);

  const changed: { from: string; to: string }[] = [];
  for (const line of current) {
    const match = incomingByKey.get(keyOf(line));
    if (!match) continue;

    const from = lineText(line);
    const to = lineText(match);
    if (from !== to) changed.push({ from, to });
  }

  return { added, removed, changed };
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Every field that differs. An empty result means the re-import found nothing
 * new, which is worth saying plainly rather than showing an empty panel.
 */
export function diffRecipes(
  current: RecipeFormValue,
  incoming: RecipeFormValue,
): Difference[] {
  const out: Difference[] = [];

  const scalar = (field: DiffField, a: unknown, b: unknown) => {
    if (a !== b) out.push({ field, current: asText(a), incoming: asText(b) });
  };

  scalar("title", current.title, incoming.title);
  scalar("servings", current.servings, incoming.servings);
  scalar("totalMinutes", current.totalMinutes, incoming.totalMinutes);
  scalar("kcalPerServing", current.kcalPerServing, incoming.kcalPerServing);

  // An image is either there or it is not; two different Blob URLs for the same
  // photo are not a difference anyone can act on, so only presence is compared.
  if (Boolean(current.imageUrl) !== Boolean(incoming.imageUrl)) {
    out.push({
      field: "imageUrl",
      current: current.imageUrl ? "✓" : "—",
      incoming: incoming.imageUrl ? "✓" : "—",
    });
  }

  if (!sameList(current.steps, incoming.steps)) {
    out.push({
      field: "steps",
      current: `${current.steps.length}`,
      incoming: `${incoming.steps.length}`,
    });
  }

  if (!sameList(current.tips, incoming.tips)) {
    out.push({
      field: "tips",
      current: `${current.tips.length}`,
      incoming: `${incoming.tips.length}`,
    });
  }

  if (!sameList([...current.tagSlugs].sort(), [...incoming.tagSlugs].sort())) {
    out.push({
      field: "tagSlugs",
      current: asText(current.tagSlugs),
      incoming: asText(incoming.tagSlugs),
    });
  }

  const lines = diffIngredientLines(current.ingredientLines, incoming.ingredientLines);
  if (lines.added.length || lines.removed.length || lines.changed.length) {
    out.push({
      field: "ingredientLines",
      current: `${current.ingredientLines.length}`,
      incoming: [
        lines.added.length ? `+${lines.added.length}` : null,
        lines.removed.length ? `−${lines.removed.length}` : null,
        lines.changed.length ? `~${lines.changed.length}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  return out;
}
