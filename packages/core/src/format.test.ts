import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "./copy.ts";
import { count, formatDuration, formatNumber, plural } from "./format.ts";

const { servings } = copy.units;

test("Polish plurals use all three forms", () => {
  assert.equal(plural(1, servings), "porcja");

  // few: 2-4, and anything ending 2-4 above 20
  assert.equal(plural(2, servings), "porcje");
  assert.equal(plural(4, servings), "porcje");
  assert.equal(plural(22, servings), "porcje");
  assert.equal(plural(103, servings), "porcje");

  // many: 0, 5-21, and the teens that look like "few" but are not
  assert.equal(plural(0, servings), "porcji");
  assert.equal(plural(5, servings), "porcji");
  assert.equal(plural(12, servings), "porcji");
  assert.equal(plural(13, servings), "porcji");
  assert.equal(plural(14, servings), "porcji");
  assert.equal(plural(21, servings), "porcji");

  // fractions take the genitive, same as many
  assert.equal(plural(1.5, servings), "porcji");
});

test("count formats the number the Polish way", () => {
  assert.equal(count(1, servings), "1 porcja");
  assert.equal(count(3, servings), "3 porcje");
  assert.equal(count(7, servings), "7 porcji");
  // comma as decimal separator, not a full stop
  assert.equal(count(1.5, servings), "1,5 porcji");
});

test("every plural form set has all three forms filled in", () => {
  for (const [name, forms] of Object.entries(copy.units)) {
    for (const form of ["one", "few", "many"] as const) {
      assert.ok(
        forms[form].length > 0,
        `copy.units.${name}.${form} is empty`,
      );
    }
  }
});

test("formatNumber uses a comma", () => {
  assert.equal(formatNumber(0.5), "0,5");
  assert.equal(formatNumber(3), "3");
});

test("formatDuration is null when there is no time to show", () => {
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(0), null);
  assert.equal(formatDuration(35), "35 min");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(75), "1 h 15 min");
});
