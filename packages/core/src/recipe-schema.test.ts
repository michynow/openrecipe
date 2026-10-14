import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "./copy.ts";
import { checkImage, recipeSchema } from "./recipe-schema.ts";

/** A minimally valid Recipe. Each test bends one thing out of shape. */
const valid = () => ({
  title: "Żurek",
  servings: 4,
  totalMinutes: 90,
  kcalPerServing: 320,
  sourceUrl: null,
  imageUrl: null,
  ingredientLines: [
    { quantity: 2, unit: "tbsp", item: "masło", note: "roztopione", substitutes: [] },
    { quantity: null, unit: null, item: "sól", note: "do smaku", substitutes: [] },
  ],
  steps: ["Zagotuj zakwas.", "Dodaj kiełbasę."],
  tips: ["Podawaj z jajkiem."],
  tagSlugs: ["polish", "dinner"],
});

const reasons = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

test("accepts a valid Recipe", () => {
  const parsed = recipeSchema.parse(valid());
  assert.equal(parsed.title, "Żurek");
  assert.equal(parsed.ingredientLines.length, 2);
  // null quantity survives as null — it means "to taste", not zero
  assert.equal(parsed.ingredientLines[1].quantity, null);
});

test("rejects an empty title", () => {
  const result = recipeSchema.safeParse({ ...valid(), title: "   " });
  assert.equal(result.success, false);
  assert.ok(reasons(result).includes(copy.validation.titleRequired));
});

test("rejects more than 5 tags", () => {
  const result = recipeSchema.safeParse({
    ...valid(),
    tagSlugs: ["polish", "dinner", "spicy", "comfort", "under-30", "healthy"],
  });
  assert.equal(result.success, false);
  assert.ok(reasons(result).includes(copy.validation.tagsTooMany));
});

test("rejects duplicate tags", () => {
  const result = recipeSchema.safeParse({
    ...valid(),
    tagSlugs: ["polish", "polish"],
  });
  assert.equal(result.success, false);
  assert.ok(reasons(result).includes(copy.validation.tagsDuplicate));
});

test("rejects a Recipe with no Ingredient Lines", () => {
  const result = recipeSchema.safeParse({ ...valid(), ingredientLines: [] });
  assert.equal(result.success, false);
  assert.ok(reasons(result).includes(copy.validation.ingredientsRequired));
});

test("rejects a negative quantity", () => {
  const result = recipeSchema.safeParse({
    ...valid(),
    ingredientLines: [{ quantity: -1, unit: "g", item: "mąka", note: null, substitutes: [] }],
  });
  assert.equal(result.success, false);
  assert.ok(reasons(result).includes(copy.validation.quantityPositive));
});

test("rejects an Ingredient Line with no item", () => {
  const result = recipeSchema.safeParse({
    ...valid(),
    ingredientLines: [{ quantity: 1, unit: "g", item: "", note: null, substitutes: [] }],
  });
  assert.equal(result.success, false);
  assert.ok(reasons(result).includes(copy.validation.itemRequired));
});

test("rejects no steps", () => {
  const result = recipeSchema.safeParse({ ...valid(), steps: [] });
  assert.equal(result.success, false);
  assert.ok(reasons(result).includes(copy.validation.stepsRequired));
});

test("rejects servings outside 1-99", () => {
  for (const servings of [0, 100, 1.5]) {
    const result = recipeSchema.safeParse({ ...valid(), servings });
    assert.equal(result.success, false, `servings ${servings} should be rejected`);
  }
});

test("empty strings from an untouched form field mean absent, not zero", () => {
  const parsed = recipeSchema.parse({
    ...valid(),
    totalMinutes: "",
    kcalPerServing: "",
    sourceUrl: "",
  });
  assert.equal(parsed.totalMinutes, null);
  assert.equal(parsed.kcalPerServing, null);
  assert.equal(parsed.sourceUrl, null);
});

test("coerces numeric strings, because form fields are strings", () => {
  const parsed = recipeSchema.parse({
    ...valid(),
    servings: "6",
    totalMinutes: "45",
  });
  assert.equal(parsed.servings, 6);
  assert.equal(parsed.totalMinutes, 45);
});

test("rejects non-http URL schemes", () => {
  /**
   * "kwestiasmaku" is the regression: it is not a URL at all, so the old
   * `.url()` + `new URL(value).protocol` refinement threw TypeError instead of
   * failing the parse — Zod 4 runs later checks even after an earlier one fails.
   * safeParse is supposed to be total; it was not.
   */
  for (const sourceUrl of [
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://x.pl/a",
    "kwestiasmaku",
  ]) {
    const result = recipeSchema.safeParse({ ...valid(), sourceUrl });
    assert.equal(result.success, false, `${sourceUrl} should be rejected`);
  }
  assert.equal(
    recipeSchema.parse({ ...valid(), sourceUrl: "https://x.pl/a" }).sourceUrl,
    "https://x.pl/a",
  );
});

test("trims text rather than storing padded strings", () => {
  const parsed = recipeSchema.parse({ ...valid(), title: "  Ragù  " });
  assert.equal(parsed.title, "Ragù");
});

test("checkImage enforces type then size", () => {
  assert.equal(checkImage({ size: 1000, type: "image/webp" }), null);
  assert.equal(
    checkImage({ size: 1000, type: "image/gif" }),
    copy.validation.imageWrongType,
  );
  assert.equal(
    checkImage({ size: 6 * 1024 * 1024, type: "image/png" }),
    copy.validation.imageTooBig,
  );
});

test("toFormValue keeps what the editor edits and drops ids", async () => {
  const { toFormValue } = await import("./recipe-schema.ts");
  const value = toFormValue({
    title: "Żurek",
    servings: 4,
    totalMinutes: 60,
    kcalPerServing: null,
    sourceUrl: null,
    imageUrl: null,
    steps: ["Gotuj"],
    tips: [],
    ingredientLines: [{ id: "x", quantity: 1, unit: "l", item: "zakwas", note: null, substitutes: [] }],
    tags: [{ slug: "soup" }],
  });
  assert.deepEqual(value.ingredientLines, [{ quantity: 1, unit: "l", item: "zakwas", note: null, section: null, substitutes: [] }]);
  assert.deepEqual(value.tagSlugs, ["soup"]);
});

test("sniffImageType reads magic bytes, not names", async () => {
  const { sniffImageType } = await import("./recipe-schema.ts");
  const b = (...n: number[]) => new Uint8Array(n);
  assert.equal(sniffImageType(b(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(sniffImageType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(sniffImageType(b(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50)), "image/webp");
  // RIFF but not WEBP (a WAV), HTML, empty.
  assert.equal(sniffImageType(b(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)), null);
  assert.equal(sniffImageType(new TextEncoder().encode("<html>")), null);
  assert.equal(sniffImageType(b()), null);
});

test("isHttpUrl accepts http(s) only", async () => {
  const { isHttpUrl } = await import("./recipe-schema.ts");
  assert.equal(isHttpUrl("https://example.com/a"), true);
  assert.equal(isHttpUrl("HTTP://example.com"), true);
  for (const bad of ["javascript:alert(1)", "intent://x", "//example.com", "example.com", "", null]) {
    assert.equal(isHttpUrl(bad), false, String(bad));
  }
});

test("Sections are trimmed and kept contiguous, ungrouped lines first", () => {
  const parsed = recipeSchema.parse({
    ...valid(),
    ingredientLines: [
      { item: "mąka", section: "  Ciasto " },
      { item: "sól", section: "" },
      { item: "pomidory", section: "Sos" },
      { item: "jajko", section: "Ciasto" },
    ],
  });
  assert.deepEqual(
    parsed.ingredientLines.map((l) => [l.section, l.item]),
    [
      [null, "sól"],
      ["Ciasto", "mąka"],
      ["Ciasto", "jajko"],
      ["Sos", "pomidory"],
    ],
  );
});
