import assert from "node:assert/strict";
import { test } from "node:test";

import { recipeSchema } from "./recipe-schema.ts";
import { firstErrorField, toFieldErrors } from "./form-errors.ts";

const invalid = {
  title: "",
  servings: 0,
  totalMinutes: null,
  kcalPerServing: null,
  sourceUrl: null,
  imageUrl: null,
  ingredientLines: [{ quantity: -1, unit: null, item: "", note: null, substitutes: [] }],
  steps: [],
  tips: [],
  tagSlugs: [],
};

test("keys errors by dotted field path", () => {
  const result = recipeSchema.safeParse(invalid);
  assert.equal(result.success, false);
  const errors = toFieldErrors(result.error!);

  assert.ok(errors.title, "expected a title error");
  assert.ok(errors.servings, "expected a servings error");
  assert.ok(errors.steps, "expected a steps error");
  // Nested array fields address as ingredientLines.<index>.<field>
  assert.ok(
    errors["ingredientLines.0.item"],
    `expected a nested item error, got ${Object.keys(errors).join(", ")}`,
  );
});

test("keeps only the first issue per field", () => {
  const result = recipeSchema.safeParse({ ...invalid, title: "" });
  const errors = toFieldErrors(result.error!);
  // One string per key, never an array
  for (const value of Object.values(errors)) {
    assert.equal(typeof value, "string");
  }
});

test("firstErrorField follows the form's order, not Zod's", () => {
  const errors = { steps: "b", title: "a" };
  assert.equal(firstErrorField(errors, ["title", "servings", "steps"]), "title");
  assert.equal(firstErrorField(errors, ["steps", "title"]), "steps");
});

test("firstErrorField finds nested fields by prefix", () => {
  const errors = { "ingredientLines.2.item": "x" };
  assert.equal(
    firstErrorField(errors, ["title", "ingredientLines"]),
    "ingredientLines.2.item",
  );
});

test("firstErrorField falls back to any error rather than returning null", () => {
  assert.equal(firstErrorField({ mystery: "x" }, ["title"]), "mystery");
  assert.equal(firstErrorField({}, ["title"]), null);
});
