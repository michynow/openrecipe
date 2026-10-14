import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildShoppingListText,
  mergeShoppingList,
  normalizeItem,
  rowKey,
  type ShoppingListSource,
} from "./shopping-list.ts";

const line = (item: string, quantity: number | null = null, unit: string | null = null) => ({
  item,
  quantity,
  unit,
});

const source = (over: Partial<ShoppingListSource>): ShoppingListSource => ({
  recipeId: "r1",
  slug: "ragu",
  title: "Ragu",
  servings: 4,
  baseServings: 4,
  excluded: [],
  lines: [],
  ...over,
});

const ragu = source({
  lines: [line("Mleko", 250, "ml"), line("cebula", 1), line("sól")],
});
const salad = source({
  recipeId: "r2",
  slug: "salatka",
  title: "Sałatka",
  servings: 4,
  baseServings: 2,
  lines: [line("  mleko ", 100, "ml"), line("Mleko", 1, "szklanka"), line("Sól", null, "szczypta")],
});

test("normalises item text but keeps Polish diacritics", () => {
  assert.equal(normalizeItem("  Żółty   SER "), "żółty ser");
  assert.notEqual(rowKey(line("sól", 1, "g")), rowKey(line("sol", 1, "g")));
  // Quantity-less lines share one row whatever their unit.
  assert.equal(rowKey(line("Sól")), rowKey(line("sól", null, "szczypta")));
});

test("same item + unit is summed after scaling; other units sit beside it", () => {
  const list = mergeShoppingList([ragu, salad], []);
  const milk = list.groups.find((g) => g.item === "Mleko");
  assert.ok(milk);
  assert.deepEqual(
    milk.rows.map((r) => [r.unit, r.quantity]),
    [
      ["ml", 450], // 250 + 100 × 2
      ["szklanka", 2],
    ],
  );
  assert.deepEqual(
    milk.rows[0].sources.map((s) => s.title),
    ["Ragu", "Sałatka"],
  );
});

test("do-smaku lines merge into one unquantified row", () => {
  const list = mergeShoppingList([ragu, salad], []);
  const salt = list.groups.find((g) => g.item === "sól");
  assert.deepEqual(salt?.rows.map((r) => [r.unit, r.quantity, r.sources.length]), [[null, null, 2]]);
});

test("groups keep first-appearance order", () => {
  const list = mergeShoppingList([ragu, salad], []);
  assert.deepEqual(list.groups.map((g) => g.item), ["Mleko", "cebula", "sól"]);
});

test("excluded rows stay off and are counted per Recipe", () => {
  const list = mergeShoppingList(
    [{ ...ragu, excluded: [rowKey(line("cebula", 1))] }],
    [],
  );
  assert.equal(list.groups.some((g) => g.item === "cebula"), false);
  assert.equal(list.recipes[0].skipped, 1);
});

test("a tick holds until more is needed than was ticked", () => {
  const key = rowKey(line("mleko", 1, "ml"));
  const ticks = [{ key, quantity: 250 }];

  const alone = mergeShoppingList([ragu], ticks);
  assert.equal(alone.groups[0].rows[0].ticked, true);

  const more = mergeShoppingList([ragu, salad], ticks);
  assert.equal(more.groups[0].rows[0].ticked, false, "450 ml needed, 250 ml bought");

  // A quantity-less row is ticked by any tick.
  const salt = mergeShoppingList([ragu], [{ key: rowKey(line("sól")), quantity: null }]);
  assert.equal(salt.groups[2].rows[0].ticked, true);
});

test("text export: unticked bullets, basket count, Recipes footer", () => {
  const list = mergeShoppingList([ragu, salad], [{ key: rowKey(line("cebula", 1)), quantity: 1 }]);
  assert.equal(
    buildShoppingListText(list),
    [
      "Lista zakupów — 2 przepisy",
      "",
      "• 450 ml Mleko",
      "• 2 szklanka Mleko",
      "• sól",
      "",
      "(1 z 4 już w koszyku)",
      "",
      "Na: Ragu (4 porcje), Sałatka (4 porcje)",
    ].join("\n"),
  );
});

test("text export: empty and all-ticked lists say so", () => {
  assert.equal(buildShoppingListText({ recipes: [], groups: [] }), "Lista zakupów — 0 przepisów\n\nLista pusta. Wrzuć przepis, a składniki same tu wskoczą.");

  const list = mergeShoppingList([source({ lines: [line("sól")] })], [{ key: rowKey(line("sól")), quantity: null }]);
  assert.equal(
    buildShoppingListText(list),
    "Lista zakupów — 1 przepis\n\nWszystko w koszyku. Do kasy!\n\nNa: Ragu (4 porcje)",
  );
});
