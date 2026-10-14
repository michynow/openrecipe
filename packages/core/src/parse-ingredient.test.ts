import assert from "node:assert/strict";
import { test } from "node:test";

import { parseIngredientBlock, parseIngredientLine } from "./parse-ingredient.ts";

test("splits quantity, unit and item", () => {
  assert.deepEqual(parseIngredientLine("2 łyżki masła"), {
    quantity: 2,
    unit: "łyżki",
    item: "masła",
    note: null,
  });
});

test("keeps an unrecognised word as part of the item, not as a unit", () => {
  // "jajka" is not a unit — inventing one would be worse than leaving it alone.
  assert.deepEqual(parseIngredientLine("2 jajka"), {
    quantity: 2,
    unit: null,
    item: "jajka",
    note: null,
  });
});

test("handles a missing quantity — 'to taste' is a real state", () => {
  assert.deepEqual(parseIngredientLine("sól"), {
    quantity: null,
    unit: null,
    item: "sól",
    note: null,
  });
});

test("takes everything after a comma as a note", () => {
  assert.deepEqual(parseIngredientLine("2 łyżki masła, roztopionego"), {
    quantity: 2,
    unit: "łyżki",
    item: "masła",
    note: "roztopionego",
  });
  assert.deepEqual(parseIngredientLine("sól, do smaku"), {
    quantity: null,
    unit: null,
    item: "sól",
    note: "do smaku",
  });
});

test("does not mistake a decimal comma for a note boundary", () => {
  assert.deepEqual(parseIngredientLine("1,5 szklanki mleka"), {
    quantity: 1.5,
    unit: "szklanki",
    item: "mleka",
    note: null,
  });
});

test("reads vulgar fractions", () => {
  assert.equal(parseIngredientLine("½ szklanki mleka").quantity, 0.5);
  assert.equal(parseIngredientLine("1½ szklanki mleka").quantity, 1.5);
  assert.equal(parseIngredientLine("¾ łyżeczki soli").quantity, 0.75);
});

test("reads written fractions", () => {
  assert.equal(parseIngredientLine("1/2 szklanki mleka").quantity, 0.5);
  assert.equal(parseIngredientLine("1 1/2 szklanki mleka").quantity, 1.5);
});

test("a range takes its lower bound", () => {
  assert.equal(parseIngredientLine("2-3 ziemniaki").quantity, 2);
  assert.equal(parseIngredientLine("2 – 3 ziemniaki").quantity, 2);
});

test("takes parenthesised trailing text as a note", () => {
  assert.deepEqual(parseIngredientLine("1 cebula (drobno posiekana)"), {
    quantity: 1,
    unit: null,
    item: "cebula",
    note: "drobno posiekana",
  });
});

test("strips pasted list bullets", () => {
  assert.equal(parseIngredientLine("- 2 łyżki masła").item, "masła");
  assert.equal(parseIngredientLine("• 2 łyżki masła").item, "masła");
});

test("splits a pasted block into one row per line, skipping blanks", () => {
  const lines = parseIngredientBlock(
    "2 łyżki masła\n\n1,5 szklanki mleka\n  sól, do smaku  \n",
  );
  assert.equal(lines.length, 3);
  assert.equal(lines[0].item, "masła");
  assert.equal(lines[1].quantity, 1.5);
  assert.equal(lines[2].note, "do smaku");
});

test("English units are recognised too, for imported text", () => {
  assert.deepEqual(parseIngredientLine("2 tbsp butter"), {
    quantity: 2,
    unit: "tbsp",
    item: "butter",
    note: null,
  });
});

test("never throws on odd input", () => {
  for (const raw of ["", "   ", "123", "!!!", "2", "g", ","]) {
    const parsed = parseIngredientLine(raw);
    assert.equal(typeof parsed.item, "string");
  }
});
