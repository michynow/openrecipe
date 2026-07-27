import assert from "node:assert/strict";
import { test } from "node:test";

import { formatQuantity, formatScaledQuantity, scaleQuantity } from "./quantity.ts";

test("a null quantity survives scaling as null", () => {
  // "sól — do smaku" must never become "1,5 do smaku"
  assert.equal(scaleQuantity(null, 2), null);
  assert.equal(scaleQuantity(null, 0.5), null);
  assert.equal(formatScaledQuantity(null, 3), "");
});

test("scales plain numbers", () => {
  assert.equal(scaleQuantity(2, 2), 4);
  assert.equal(scaleQuantity(0.5, 3), 1.5);
  assert.equal(scaleQuantity(100, 0.5), 50);
});

test("renders the fractions people write on recipe cards", () => {
  assert.equal(formatQuantity(0.5), "½");
  assert.equal(formatQuantity(0.25), "¼");
  assert.equal(formatQuantity(0.75), "¾");
  assert.equal(formatQuantity(0.375), "⅜");
  assert.equal(formatQuantity(0.125), "⅛");
  assert.equal(formatQuantity(2 / 3), "⅔");
});

test("renders thirds without a wall of decimals", () => {
  assert.equal(formatQuantity(1 / 3), "⅓");
  assert.equal(formatQuantity(4 / 3), "1⅓");
  // the classic: 1 egg scaled by 3 servings out of 9
  assert.equal(formatQuantity(0.3333333333333333), "⅓");
});

test("combines a whole part with a fraction", () => {
  assert.equal(formatQuantity(1.5), "1½");
  assert.equal(formatQuantity(2.25), "2¼");
  assert.equal(formatQuantity(3.75), "3¾");
});

test("whole numbers render bare, with no trailing zeros", () => {
  assert.equal(formatQuantity(1), "1");
  assert.equal(formatQuantity(4), "4");
  assert.equal(formatQuantity(750), "750");
  // floating point drift must not produce "2,0000001"
  assert.equal(formatQuantity(2.0000001), "2");
  assert.equal(formatQuantity(1.999999), "2");
});

test("falls back to a Polish decimal when no fraction fits", () => {
  // comma, not a full stop
  assert.equal(formatQuantity(0.47), "0,47");
  assert.equal(formatQuantity(1.07), "1,07");
});

test("never emits long decimal tails", () => {
  for (const n of [0.123456789, 7.987654321, 1 / 7, 22 / 7]) {
    const rendered = formatQuantity(n);
    const decimals = rendered.split(",")[1];
    assert.ok(
      decimals === undefined || decimals.length <= 2,
      `${n} rendered as "${rendered}"`,
    );
  }
});

test("scale then format, the way the Recipe page will", () => {
  // 4-serving recipe viewed at 6 servings: factor 1.5
  assert.equal(formatScaledQuantity(2, 1.5), "3");
  assert.equal(formatScaledQuantity(0.5, 1.5), "¾");
  assert.equal(formatScaledQuantity(1, 1.5), "1½");
  // and halved
  assert.equal(formatScaledQuantity(1, 0.5), "½");
  assert.equal(formatScaledQuantity(3, 0.5), "1½");
});

test("handles zero and negatives without producing nonsense", () => {
  assert.equal(formatQuantity(0), "0");
  assert.equal(formatQuantity(-0.5), "-½");
  assert.equal(formatQuantity(Number.NaN), "");
  assert.equal(formatQuantity(Number.POSITIVE_INFINITY), "");
});
