import { parseIngredientBlock } from "../parse-ingredient.ts";
import { recipeSchema, type RecipeFormValue } from "../recipe-schema.ts";
import type { ExtractedPage } from "./extract.ts";

/**
 * Turning an extracted page into a Draft payload, with no model involved
 * (OR-40).
 *
 * This is the honest half of the pipeline: where the page published structured
 * data, everything here is copied, and the only guess is how an ingredient line
 * splits into quantity, unit and item — reusing the same naive splitter the
 * paste-a-block affordance uses, whose wrong guesses are one keystroke to fix in
 * review.
 *
 * OR-42 puts a model in front of this for pages that publish nothing, and to
 * translate, tag, compress steps and write Substitutes. Deliberately separable:
 * a JSON-LD page can already become a Draft without a single token spent.
 */

/** PRD §12: a Step is one line, at most 300 characters. */
const MAX_LINE = 300;

/**
 * Long instruction blobs into short lines, splitting on sentence ends.
 *
 * Sites routinely put a whole method in one `HowToStep`. Splitting on sentences
 * gets closer to "a line, not a paragraph" (CONTEXT.md) than truncating would,
 * and a sentence that is still too long is cut rather than dropped — a truncated
 * step is editable in review; a missing one is invisible.
 */
export function toShortLines(value: string, max = MAX_LINE): string[] {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= max) return [text];

  const out: string[] = [];
  let current = "";

  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (sentence.length > max) {
      if (current) out.push(current.trim());
      current = "";
      for (let i = 0; i < sentence.length; i += max) {
        out.push(sentence.slice(i, i + max).trim());
      }
      continue;
    }

    if ((current + " " + sentence).trim().length > max) {
      out.push(current.trim());
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }

  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

export type BuildResult =
  | { ok: true; payload: RecipeFormValue }
  | { ok: false; reason: "needs-a-model" | "invalid" };

/**
 * Build a Draft payload from an extracted page.
 *
 * Returns `needs-a-model` rather than a half-empty Recipe when the page gave no
 * structured ingredients or steps: a Draft that reaches review missing its
 * ingredients wastes the reviewer's time in a way a clear failure does not.
 */
export function buildPayload(
  page: ExtractedPage,
  sourceUrl: string,
): BuildResult {
  if (page.ingredients.length === 0 || page.instructions.length === 0) {
    return { ok: false, reason: "needs-a-model" };
  }

  const ingredientLines = parseIngredientBlock(page.ingredients.join("\n")).map(
    (line) => ({ ...line, substitutes: [] }),
  );

  const steps = page.instructions.flatMap((line) => toShortLines(line));

  const candidate: RecipeFormValue = {
    title: (page.title ?? "").slice(0, 120).trim() || "Bez nazwy",
    servings: page.servings ?? 4,
    totalMinutes: page.totalMinutes,
    kcalPerServing: page.kcalPerServing,
    sourceUrl,
    // The Worker's image pipeline is OR-43; until then a Draft carries no photo
    // rather than hotlinking one that will rot.
    imageUrl: null,
    ingredientLines,
    steps,
    tips: [],
    // Tags come from the closed list and the model picks them (OR-42). Nothing
    // here is allowed to invent one.
    tagSlugs: [],
  };

  // The same schema the editor and the Server Action use. A payload that cannot
  // pass it must not reach review as `ready`.
  return recipeSchema.safeParse(candidate).success
    ? { ok: true, payload: candidate }
    : { ok: false, reason: "invalid" };
}
