import assert from "node:assert/strict";
import { test } from "node:test";

import { buildShoppingExport, type ExportLine } from "./shopping-export.ts";

const lines: ExportLine[] = [
  { id: "a", quantity: 750, unit: "g", item: "mięso mielone" },
  { id: "b", quantity: 3, unit: "łyżki", item: "koncentrat pomidorowy" },
  { id: "c", quantity: 1, unit: null, item: "cebula" },
  { id: "d", quantity: null, unit: null, item: "sól" },
];

test("nothing ticked exports the whole list", () => {
  const text = buildShoppingExport({
    title: "Ragu",
    servings: 4,
    factor: 1,
    lines,
    checked: [],
  });

  assert.equal(
    text,
    [
      "Ragu — 4 porcje",
      "",
      "• 750 g mięso mielone",
      "• 3 łyżki koncentrat pomidorowy",
      "• 1 cebula",
      "• sól",
    ].join("\n"),
  );
});

test("ticked lines drop out and are counted at the bottom", () => {
  const text = buildShoppingExport({
    title: "Ragu",
    servings: 4,
    factor: 1,
    lines,
    checked: ["b", "d"],
  });

  assert.equal(
    text,
    ["Ragu — 4 porcje", "", "• 750 g mięso mielone", "• 1 cebula", "", "(2 z 4 już masz)"].join(
      "\n",
    ),
  );
});

test("everything ticked says so instead of exporting nothing", () => {
  const text = buildShoppingExport({
    title: "Ragu",
    servings: 4,
    factor: 1,
    lines,
    checked: ["a", "b", "c", "d"],
  });

  assert.equal(text, "Ragu — 4 porcje\n\nMasz wszystko. Do dzieła.");
});

test("quantities follow the displayed scale, as fractions", () => {
  const text = buildShoppingExport({
    title: "Ragu",
    servings: 6,
    factor: 1.5,
    lines,
    checked: [],
  });

  assert.match(text, /^Ragu — 6 porcji$/m);
  assert.match(text, /• 1125 g mięso mielone/);
  assert.match(text, /• 4½ łyżki koncentrat pomidorowy/);
  assert.match(text, /• 1½ cebula/);
  // A line with no quantity is not scaled into existence.
  assert.match(text, /• sól$/m);
});

test("Polish plurals on the serving count", () => {
  const at = (servings: number) =>
    buildShoppingExport({
      title: "Ragu",
      servings,
      factor: 1,
      lines,
      checked: [],
    }).split("\n")[0];

  assert.equal(at(1), "Ragu — 1 porcja");
  assert.equal(at(3), "Ragu — 3 porcje");
  assert.equal(at(7), "Ragu — 7 porcji");
});

test("substitutes ride along in parentheses", () => {
  const text = buildShoppingExport({
    title: "Sałatka",
    servings: 2,
    factor: 1,
    lines: [
      { id: "a", quantity: 1, unit: null, item: "ogórek", substitutes: [{ item: "pomidor" }] },
      { id: "b", quantity: 100, unit: "g", item: "feta", substitutes: [{ item: "mozzarella" }, { item: "tofu" }] },
      { id: "c", quantity: null, unit: null, item: "sól", substitutes: [] },
    ],
    checked: [],
  });

  assert.equal(
    text,
    ["Sałatka — 2 porcje", "", "• 1 ogórek (albo pomidor)", "• 100 g feta (albo mozzarella, tofu)", "• sól"].join("\n"),
  );
});
