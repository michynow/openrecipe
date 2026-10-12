import assert from "node:assert/strict";
import { test } from "node:test";

import { SPRITES, spriteFor } from "./ingredient-sprites.ts";
import { spriteProblem } from "./pixel.ts";

test("every sprite is 12×12 and drawn only in palette letters", () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    assert.equal(spriteProblem(rows), null, name);
  }
});

test("items from real recipes find their sprite", () => {
  const cases: [string, string][] = [
    ["jogurt grecki", "milk"],
    ["kefir", "milk"],
    ["ajran", "milk"],
    ["ogórki gruntowe", "cucumber"],
    ["czosnek", "garlic"],
    ["koperek", "herb"],
    ["oliwa extra", "oil"],
    ["sok z cytryny", "lemon"],
    ["orzechy włoskie", "nut"],
    ["mięta", "herb"],
    ["sumak", "pot"],
    ["jajka", "egg"],
    ["mąka pszenna", "flour"],
    ["pierś z kurczaka", "chicken"],
    ["łosoś wędzony", "fish"],
    ["ser feta", "cheese"],
  ];
  for (const [item, sprite] of cases) assert.equal(spriteFor(item), sprite, item);
});

test("earliest word wins, then the longer stem", () => {
  assert.equal(spriteFor("sól i pieprz"), "salt");
  assert.equal(spriteFor("masło orzechowe"), "butter");
  assert.equal(spriteFor("papryka wędzona"), "spice");
  assert.equal(spriteFor("papryka czerwona"), "bellPepper");
  assert.equal(spriteFor("makaron penne"), "pasta");
});

test("a stem only matches at the start of a word", () => {
  assert.equal(spriteFor("fasola"), "bean"); // not "sol"
  assert.equal(spriteFor("mieszanka przypraw"), "spice"); // not meat
});
