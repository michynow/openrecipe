import assert from "node:assert/strict";
import { test } from "node:test";

import { guessedFields } from "./inferred.ts";

test("field names as asked pass straight through", () => {
  const { fields } = guessedFields(["servings", "totalMinutes", "kcalPerServing"]);
  assert.deepEqual([...fields].sort(), ["kcalPerServing", "servings", "totalMinutes"]);
});

test("the model's own spellings land on the field they mean", () => {
  const { fields } = guessedFields([
    "ingredientLines[2].quantity",
    "ingredients",
    "time",
    "calories",
    "tags",
    "ingredient_lines.0.unit",
  ]);
  assert.deepEqual([...fields].sort(), ["ingredientLines", "kcalPerServing", "tagSlugs", "totalMinutes"]);
});

test("the fallback's 'translation' is a flag, not a field", () => {
  const result = guessedFields(["translation"]);
  assert.equal(result.untranslated, true);
  assert.equal(result.fields.size, 0);
});

test("names nobody can mark are dropped", () => {
  assert.equal(guessedFields(["mood", ""]).fields.size, 0);
});
