import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { extractFromHtml } from "./extract.ts";
import { buildPayload, toShortLines } from "./payload.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

const pageFrom = (name: string) => {
  const result = extractFromHtml(fixture(name));
  if (!result.ok) throw new Error(`fixture ${name} did not extract`);
  return result.page;
};

test("a JSON-LD page becomes a valid Draft payload with no model", () => {
  const built = buildPayload(pageFrom("json-ld-graph.html"), "https://example.test/p");
  assert.equal(built.ok, true);
  if (!built.ok) return;

  const { payload } = built;
  assert.equal(payload.title, "Placek ziemniaczany");
  assert.equal(payload.servings, 4);
  assert.equal(payload.totalMinutes, 90);
  assert.equal(payload.kcalPerServing, 540);
  assert.equal(payload.sourceUrl, "https://example.test/p");
  assert.equal(payload.steps.length, 3);

  // The naive splitter's job, not the model's: "1 kg ziemniaków" is three parts.
  assert.deepEqual(payload.ingredientLines[0], {
    quantity: 1,
    unit: "kg",
    item: "ziemniaków",
    note: null,
    section: null,
    substitutes: [],
  });

  // Nothing invents a Tag, and no image is hotlinked from the source (OR-43).
  assert.deepEqual(payload.tagSlugs, []);
  assert.equal(payload.imageUrl, null);
});

test("the page's Sections reach the payload, contiguous", () => {
  const built = buildPayload(pageFrom("html-ingredient-groups.html"), "https://example.test/p");
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.deepEqual(
    built.payload.ingredientLines.map((line) => [line.section, line.item]),
    [
      ["Bułki", "mąki"],
      ["Bułki", "drożdży"],
      ["Kotlety", "wołowiny"],
      ["Kotlety", "sól"],
      ["Surówka", "ogórek"],
      ["Surówka", "majonezu"],
    ],
  );
});

test("a page with only prose is handed to the model instead", () => {
  const built = buildPayload(pageFrom("no-json-ld-pl.html"), "https://example.test/p");
  assert.equal(built.ok, false);
  if (built.ok) return;
  assert.equal(built.reason, "needs-a-model");
});

test("splits a paragraph-long instruction into lines a cook can follow", () => {
  const paragraph =
    "Cukinie umyj i pokrój wzdłuż na plastry. " +
    "Ułóż je w naczyniu żaroodpornym i skrop oliwą. " +
    "Piecz w 200 stopniach przez 25 minut, aż zmiękną.";

  const lines = toShortLines(paragraph, 60);
  assert.ok(lines.length >= 3, "one sentence per line where they fit");
  assert.ok(lines.every((line) => line.length <= 60));
  assert.match(lines[0], /^Cukinie umyj/);
});

test("a single sentence longer than the limit is cut, never dropped", () => {
  const lines = toShortLines("a".repeat(700), 300);
  assert.deepEqual(lines.map((line) => line.length), [300, 300, 100]);
});

test("empty in, empty out", () => {
  assert.deepEqual(toShortLines("   "), []);
});
