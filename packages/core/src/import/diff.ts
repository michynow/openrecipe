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

type Line = RecipeFormValue["ingredientLines"][number];

/** Ingredient lines as one comparable line each: "Sos: 2 łyżki masła (roztopione)". */
export function lineText(line: Line): string {
  const parts = [
    line.quantity === null ? null : String(line.quantity),
    line.unit,
    line.item,
  ].filter(Boolean);

  const text = line.note ? `${parts.join(" ")} (${line.note})` : parts.join(" ");
  return line.section ? `${line.section}: ${text}` : text;
}

/**
 * Matching keys for Ingredient Lines: the item, case and spacing ignored, plus
 * which occurrence of it this is — "sól" in the dough and "sól" in the sauce are
 * two lines, matched first-to-first. The Section is deliberately not in the key,
 * so moving a line into a Section reads as a change, not a removal and an addition.
 */
function keysOf(lines: readonly Line[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const item = line.item.trim().toLowerCase().replace(/\s+/g, " ");
    const n = seen.get(item) ?? 0;
    seen.set(item, n + 1);
    return `${item}#${n}`;
  });
}

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
  const currentKeys = keysOf(current);
  const incomingKeys = keysOf(incoming);
  const currentByKey = new Map(current.map((line, i) => [currentKeys[i], line]));
  const incomingByKey = new Map(incoming.map((line, i) => [incomingKeys[i], line]));

  const added = incoming
    .filter((_, i) => !currentByKey.has(incomingKeys[i]))
    .map(lineText);

  const removed = current
    .filter((_, i) => !incomingByKey.has(currentKeys[i]))
    .map(lineText);

  const changed: { from: string; to: string }[] = [];
  for (const [i, line] of current.entries()) {
    const match = incomingByKey.get(currentKeys[i]);
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

/** What "accept this one" means, field by field. */
export function patchFor(
  field: Difference["field"],
  incoming: RecipeFormValue,
): Partial<RecipeFormValue> {
  switch (field) {
    case "title":
      return { title: incoming.title };
    case "servings":
      return { servings: incoming.servings };
    case "totalMinutes":
      return { totalMinutes: incoming.totalMinutes };
    case "kcalPerServing":
      return { kcalPerServing: incoming.kcalPerServing };
    case "imageUrl":
      return { imageUrl: incoming.imageUrl };
    case "steps":
      return { steps: incoming.steps };
    case "tips":
      return { tips: incoming.tips };
    case "tagSlugs":
      return { tagSlugs: incoming.tagSlugs };
    case "ingredientLines":
      return { ingredientLines: incoming.ingredientLines };
  }
}

/** Whether the editor already holds the incoming value for this field. */
export function isTaken(
  difference: Difference,
  value: RecipeFormValue,
  incoming: RecipeFormValue,
): boolean {
  const patch = patchFor(difference.field, incoming);
  const [key] = Object.keys(patch) as (keyof RecipeFormValue)[];

  return JSON.stringify(value[key]) === JSON.stringify(incoming[key]);
}
