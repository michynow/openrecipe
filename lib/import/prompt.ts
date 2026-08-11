import type { ExtractedPage } from "./extract.ts";

/**
 * The Worker's prompt (OR-42). Its own module, deliberately: the loop in
 * scripts/worker.ts should not have to be edited to reword an instruction, and
 * this is the file to read when an import comes out wrong.
 *
 * The central rule is the one from PRD §8: when the page published its
 * ingredients, the model is never asked what they *are* — only how to structure
 * and translate them. A wrong split is visible in review; an invented ingredient
 * is not.
 */

export type TagOption = { slug: string; label: string; facet: string };

export const SYSTEM_PROMPT = `You turn recipe pages into structured records for a Polish household cookbook.

You output JSON and nothing else: no prose, no explanation, no markdown fences.

Rules, in order of importance:

1. Never invent an ingredient, a quantity or a step. If the source does not say
   it, leave the field null or omit the line. A missing quantity is normal and
   means "to taste".
2. Write in Polish. Ingredient items, steps, tips and substitute notes are all
   Polish, in the informal register (ty, not Pan/Pani).
3. Keep a dish's proper name in its own language: Shakshuka, Ragù, Pad Thai,
   Carbonara. Translate a descriptive name: "Lemon chicken" becomes "Kurczak
   cytrynowy".
4. Steps are one short line each — a line, not a paragraph. Split a long
   instruction into several steps rather than writing an essay.
5. Units follow Polish convention: g, kg, ml, l, łyżka, łyżeczka, szklanka,
   szczypta, ząbek, pęczek, garść, puszka, plaster. Convert unambiguous imperial
   units (1 lb = 450 g, 1 oz = 28 g, 1 inch = 2.5 cm). Leave an ambiguous one
   (a "cup" of a solid, a "stick" of butter) as it was and say so in the line's
   note.
6. Tags come from the list you are given, by slug, at most 5. Never invent one.
   Pick the ones you would actually filter by; fewer is better than padded.
7. Substitutes: 2 or 3 per ingredient line where a sensible one exists, each
   with a one-line Polish note saying how it differs. None at all is better than
   a bad one — do not force them onto salt or water.`;

/** The exact JSON shape wanted back, described once. */
const SHAPE = `{
  "title": string,
  "servings": integer 1-99,
  "totalMinutes": integer or null,
  "kcalPerServing": integer or null,
  "ingredientLines": [
    { "quantity": number or null,
      "unit": string or null,
      "item": string,
      "note": string or null,
      "substitutes": [ { "item": string, "note": string or null } ] }
  ],
  "steps": [ string ],
  "tips": [ string ],
  "tagSlugs": [ string ],
  "inferred": [ string ]
}`;

/**
 * `inferred` is the model's own account of what it worked out rather than read.
 * It is not part of the Recipe — it rides alongside so review can highlight the
 * fields worth a second look (PRD §7.6).
 */
export function buildPrompt(
  page: ExtractedPage,
  sourceUrl: string,
  tags: TagOption[],
): string {
  const tagList = tags
    .map((tag) => `  ${tag.slug} (${tag.facet}) — ${tag.label}`)
    .join("\n");

  const source =
    page.path === "json-ld"
      ? `The page published structured data. These are its own words, and they are
facts — do not second-guess what the ingredients or steps are, only structure
and translate them.

Title: ${page.title ?? "(none given)"}
Servings: ${page.servings ?? "(none given)"}
Total minutes: ${page.totalMinutes ?? "(none given)"}
Kcal per serving: ${page.kcalPerServing ?? "(none given)"}

Ingredients, one per line:
${page.ingredients.map((line) => `- ${line}`).join("\n")}

Instructions, in order:
${page.instructions.map((line) => `- ${line}`).join("\n")}`
      : `The page published no structured data, so this is its readable text with the
navigation and comments stripped. Read it and pull the recipe out. Anything you
work out rather than read plainly — a serving count, a time, a quantity — goes
in "inferred" by field name.

${page.text ?? ""}`;

  return `Source URL: ${sourceUrl}

${source}

Available tags — pick at most 5, by slug, only from this list:
${tagList}

Reply with one JSON object and nothing else, in this shape:
${SHAPE}

"inferred" lists the field names you worked out rather than read from the page —
for example ["servings", "totalMinutes"]. An empty list is a fine answer when
everything came straight off the page.`;
}
