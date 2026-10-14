import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addSection,
  groupSections,
  hasSections,
  moveLine,
  normalizeSections,
  removeSection,
  renameSection,
  sectionNames,
  setLineSection,
} from "./sections.ts";

type L = { item: string; section: string | null };
const l = (item: string, section: string | null = null): L => ({ item, section });
const items = (lines: L[]) => lines.map((x) => `${x.section ?? "-"}:${x.item}`).join(" ");

test("normalize: ungrouped first, then each Section together, first-appearance order", () => {
  const out = normalizeSections([l("a", "Sos"), l("b"), l("c", "Ciasto"), l("d", " Sos "), l("e")]);
  assert.equal(items(out), "-:b -:e Sos:a Sos:d Ciasto:c");
});

test("normalize: blank Section is ungrouped", () => {
  assert.equal(normalizeSections([l("a", "  ")])[0].section, null);
});

test("groupSections: consecutive runs keep flat indexes", () => {
  const groups = groupSections([l("a"), l("b", "Sos"), l("c", "Sos")]);
  assert.deepEqual(
    groups.map((g) => [g.section, g.items.map((i) => i.index)]),
    [
      [null, [0]],
      ["Sos", [1, 2]],
    ],
  );
  assert.equal(hasSections([l("a")]), false);
  assert.deepEqual(sectionNames([l("a"), l("b", "Sos"), l("c", "Ciasto")]), ["Sos", "Ciasto"]);
});

test("moveLine within a Section is a plain reorder", () => {
  const out = moveLine([l("a", "S"), l("b", "S"), l("c", "S")], 0, 2);
  assert.equal(items(out), "S:b S:c S:a");
});

test("moveLine across a heading takes the Section of the line it passed", () => {
  const lines = [l("x"), l("a", "A"), l("b", "A"), l("c", "B")];
  // b down past c: now in B, after c
  assert.equal(items(moveLine(lines, 2, 3)), "-:x A:a B:c B:b");
  // a up past x: now ungrouped
  assert.equal(items(moveLine(lines, 1, 0)), "-:a -:x A:b B:c");
  // c up past b: joins A at its end
  assert.equal(items(moveLine(lines, 3, 2)), "-:x A:a A:c A:b");
  // out of range: unchanged
  assert.equal(items(moveLine(lines, 0, 9)), items(lines));
});

test("setLineSection moves the line to the end of its new group", () => {
  const out = setLineSection([l("a"), l("b"), l("c", "Sos")], 0, "Sos");
  assert.equal(items(out), "-:b Sos:c Sos:a");
  assert.equal(items(setLineSection(out, 2, null)), "-:b -:a Sos:c");
});

test("rename, merge, remove and add", () => {
  const lines = [l("a", "A"), l("b", "B"), l("c", "A")];
  assert.equal(items(renameSection(lines, "A", "Ciasto")), "Ciasto:a Ciasto:c B:b");
  assert.equal(items(renameSection(lines, "B", "A")), "A:a A:b A:c");
  assert.equal(items(removeSection(lines, "B")), "-:b A:a A:c");
  assert.equal(items(addSection(lines, "Sos", l(""))), "A:a A:c B:b Sos:");
});
