/**
 * The Worker's "guessed" list, matched to what the review screen can mark.
 *
 * The model is asked for field names and answers in its own words: "servings"
 * as asked, but also "ingredientLines[2].quantity", "ingredients", "time" or
 * "calories". Taken literally, those mark nothing and the reviewer is never
 * told. The Worker's own page-data fallback adds "translation", which is not a
 * field at all but the most important thing to know about that Draft.
 */

export type GuessedFields = {
  /** Editor field names: title, servings, totalMinutes, ingredientLines… */
  fields: Set<string>;
  /** The page data went in untranslated — the whole Draft wants a look. */
  untranslated: boolean;
};

const FIELD: Record<string, string> = {
  title: "title",
  name: "title",
  servings: "servings",
  yield: "servings",
  totalminutes: "totalMinutes",
  totaltime: "totalMinutes",
  time: "totalMinutes",
  minutes: "totalMinutes",
  cooktime: "totalMinutes",
  preptime: "totalMinutes",
  kcalperserving: "kcalPerServing",
  kcal: "kcalPerServing",
  calories: "kcalPerServing",
  ingredientlines: "ingredientLines",
  ingredients: "ingredientLines",
  ingredient: "ingredientLines",
  quantity: "ingredientLines",
  unit: "ingredientLines",
  substitutes: "ingredientLines",
  steps: "steps",
  instructions: "steps",
  tips: "tips",
  tagslugs: "tagSlugs",
  tags: "tagSlugs",
};

export function guessedFields(inferred: readonly string[]): GuessedFields {
  const fields = new Set<string>();
  let untranslated = false;

  for (const raw of inferred) {
    // "ingredientLines[2].quantity" and "ingredient_lines.0" both mean the list.
    const root = raw.trim().split(/[[.\s]/)[0].replace(/[_-]/g, "").toLowerCase();
    if (root === "translation") untranslated = true;
    else if (FIELD[root]) fields.add(FIELD[root]);
  }

  return { fields, untranslated };
}
