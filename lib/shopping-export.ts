import { copy, pantrySkipped } from "./copy.ts";
import { count } from "./format.ts";
import { formatScaledQuantity } from "./quantity.ts";

/**
 * The Shopping Export: the unticked Ingredient Lines as plain text, at whatever
 * serving scale the reader is looking at (PRD §9).
 *
 * Plain text on purpose — it has to survive being pasted into any notes app,
 * message thread or list, so there are no per-app deep links and no markup.
 */

export type ExportLine = {
  id: string;
  quantity: number | null;
  unit: string | null;
  item: string;
};

export function buildShoppingExport({
  title,
  servings,
  factor,
  lines,
  checked,
}: {
  title: string;
  /** The serving count on screen, not the Recipe's stored one. */
  servings: number;
  factor: number;
  lines: readonly ExportLine[];
  checked: readonly string[];
}): string {
  const header = `${title} — ${count(servings, copy.units.servings)}`;
  const wanted = lines.filter((line) => !checked.includes(line.id));

  // Everything ticked. An empty list would read as a failure, so say the good news.
  if (wanted.length === 0) return `${header}\n\n${copy.recipe.nothingToBuy}`;

  const bullets = wanted
    .map(
      (line) =>
        `• ${[formatScaledQuantity(line.quantity, factor), line.unit, line.item]
          .filter(Boolean)
          .join(" ")}`,
    )
    .join("\n");

  const skipped = lines.length - wanted.length;
  // Nothing skipped means nothing to explain — the whole list is the whole recipe.
  if (skipped === 0) return `${header}\n\n${bullets}`;

  return `${header}\n\n${bullets}\n\n${pantrySkipped(skipped, lines.length)}`;
}
