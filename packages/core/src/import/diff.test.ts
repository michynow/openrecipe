import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyRecipe, type RecipeFormValue } from "../recipe-schema.ts";
import { diffIngredientLines, diffRecipes, lineText } from "./diff.ts";

const line = (
  item: string,
  quantity: number | null = null,
  unit: string | null = null,
  note: string | null = null,
) => ({ quantity, unit, item, note, substitutes: [] });

const recipe = (over: Partial<RecipeFormValue> = {}): RecipeFormValue => ({
  ...emptyRecipe,
  title: "Żurek",
  servings: 4,
  ingredientLines: [line("zakwas", 2, "szklanki"), line("kiełbasa", 300, "g")],
  steps: ["Zagotuj wywar.", "Wlej zakwas."],
  ...over,
});

test("no differences when nothing changed", () => {
  assert.deepEqual(diffRecipes(recipe(), recipe()), []);
});

test("reports the scalar fields that moved", () => {
  const differences = diffRecipes(recipe(), recipe({ servings: 6, title: "Żurek wielkanocny" }));
  assert.deepEqual(
    differences.map((d) => d.field).sort(),
    ["servings", "title"],
  );

  const servings = differences.find((d) => d.field === "servings");
  assert.equal(servings?.current, "4");
  assert.equal(servings?.incoming, "6");
});

test("an inserted ingredient is one addition, not a cascade", () => {
  // The failure this exists to prevent: matching by position would call the
  // inserted line a change and every line after it a change too.
  const current = [line("zakwas"), line("kiełbasa"), line("majeranek")];
  const incoming = [line("zakwas"), line("czosnek"), line("kiełbasa"), line("majeranek")];

  const result = diffIngredientLines(current, incoming);
  assert.deepEqual(result.added, ["czosnek"]);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.changed, []);
});

test("a changed quantity on a matched item is a change, not add plus remove", () => {
  const result = diffIngredientLines(
    [line("kiełbasa", 300, "g")],
    [line("Kiełbasa", 400, "g")],
  );

  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.changed, [{ from: "300 g kiełbasa", to: "400 g Kiełbasa" }]);
});

test("matching ignores case and stray spacing, which are not differences", () => {
  const result = diffIngredientLines([line("Ser  feta")], [line("ser feta")]);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.changed.length, 1, "the rendered text still differs");
});

test("only the presence of an image counts, never which Blob URL", () => {
  const a = recipe({ imageUrl: "https://x.private.blob.vercel-storage.com/a.webp" });
  const b = recipe({ imageUrl: "https://x.private.blob.vercel-storage.com/b.webp" });
  assert.deepEqual(diffRecipes(a, b), []);

  const gained = diffRecipes(recipe({ imageUrl: null }), a);
  assert.deepEqual(gained.map((d) => d.field), ["imageUrl"]);
});

test("tag order is not a difference", () => {
  const a = recipe({ tagSlugs: ["dinner", "polish"] });
  const b = recipe({ tagSlugs: ["polish", "dinner"] });
  assert.deepEqual(diffRecipes(a, b), []);
});

test("renders an ingredient line the way a person reads it", () => {
  assert.equal(lineText(line("masła", 2, "łyżki", "roztopione")), "2 łyżki masła (roztopione)");
  assert.equal(lineText(line("sól")), "sól");
});

test("patchFor takes one field; isTaken sees when the editor already holds it", async () => {
  const { isTaken, patchFor } = await import("./diff.ts");
  const current = { ...emptyRecipe, title: "A", servings: 2 };
  const incoming = { ...emptyRecipe, title: "B", servings: 2 };
  assert.deepEqual(patchFor("title", incoming), { title: "B" });
  const difference = { field: "title" as const, current: "A", incoming: "B" };
  assert.equal(isTaken(difference, current, incoming), false);
  assert.equal(isTaken(difference, { ...current, ...patchFor("title", incoming) }, incoming), true);
});
