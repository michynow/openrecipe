import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  extractFromHtml,
  findRecipeNode,
  instructionLines,
  isoDurationToMinutes,
  readableText,
  yieldToServings,
} from "./extract.ts";

/**
 * The fixtures are hand-written rather than saved copies of real pages: they
 * reproduce the *shapes* the real web uses — @graph nesting, HowToSection,
 * durations, a Polish blog with no structured data at all — without copying
 * anyone's recipe into this repository.
 */
const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

test("finds a Recipe nested in an @graph, even when @type is an array", () => {
  const result = extractFromHtml(fixture("json-ld-graph.html"));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const { page } = result;
  assert.equal(page.path, "json-ld");
  assert.equal(page.title, "Placek ziemniaczany");
  assert.equal(page.imageUrl, "https://example.test/placek.jpg");
  assert.equal(page.author, "Autor Testowy");
  assert.equal(page.servings, 4);
  assert.equal(page.kcalPerServing, 540);
  // No totalTime on this one: prep + cook is 20 + 70.
  assert.equal(page.totalMinutes, 90);
  assert.deepEqual(page.ingredients, ["1 kg ziemniaków", "2 jajka", "1 cebula"]);
  assert.equal(page.instructions.length, 3);
  assert.equal(page.instructions[0], "Zetrzyj ziemniaki.");
});

test("skips a malformed block and flattens HowToSection groups", () => {
  const result = extractFromHtml(fixture("json-ld-sections.html"));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const { page } = result;
  assert.equal(page.path, "json-ld");
  assert.equal(page.imageUrl, "https://example.test/zupa.jpg");
  assert.equal(page.servings, 4, "takes the first number of '4-6 porcji'");
  assert.equal(page.totalMinutes, 45);
  // Section headings are not instructions; their steps are, in order.
  assert.deepEqual(page.instructions, [
    "Podsmaż dynię.",
    "Zalej bulionem.",
    "Zmiksuj na gładko.",
  ]);
});

test("falls back to readable text on a Polish blog with no JSON-LD", () => {
  const result = extractFromHtml(fixture("no-json-ld-pl.html"));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const { page } = result;
  assert.equal(page.path, "readable-text");
  assert.equal(page.title, "Cukinia z fetą");
  assert.equal(page.imageUrl, "https://example.test/cukinia.jpg");
  assert.equal(page.ingredients.length, 0, "nothing is claimed as structured");

  const prose = page.text ?? "";
  assert.match(prose, /200 g sera feta/);
  assert.match(prose, /Piecz w temperaturze 200 stopni/);

  // The furniture must not reach the model. Comments are the dangerous one:
  // somebody's variation reads exactly like an instruction.
  assert.doesNotMatch(prose, /podwójną porcję czosnku/);
  assert.doesNotMatch(prose, /Polecane przepisy/);
  assert.doesNotMatch(prose, /Reklama/);
  assert.doesNotMatch(prose, /O nas/);
});

test("a page with no recipe on it says so", () => {
  const result = extractFromHtml(fixture("not-a-recipe.html"));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "no-recipe-found");
});

test("parses ISO-8601 durations", () => {
  assert.equal(isoDurationToMinutes("PT1H30M"), 90);
  assert.equal(isoDurationToMinutes("PT45M"), 45);
  assert.equal(isoDurationToMinutes("P1DT2H"), 1560);
  // Seconds floor away: nobody means anything by "45 minutes 30 seconds".
  assert.equal(isoDurationToMinutes("PT45M30S"), 45);
  assert.equal(isoDurationToMinutes("PT0M"), null);
  assert.equal(isoDurationToMinutes("half an hour"), null);
  assert.equal(isoDurationToMinutes(undefined), null);
});

test("reads a serving count out of whatever recipeYield holds", () => {
  assert.equal(yieldToServings(4), 4);
  assert.equal(yieldToServings("4 porcje"), 4);
  assert.equal(yieldToServings(["6-8 porcji"]), 6);
  assert.equal(yieldToServings("dużo"), null);
  assert.equal(yieldToServings("1000 porcji"), null, "beyond the schema's cap");
});

test("instructionLines copes with strings, steps and nested sections", () => {
  assert.deepEqual(instructionLines("Wymieszaj."), ["Wymieszaj."]);
  assert.deepEqual(instructionLines({ "@type": "HowToStep", name: "Piecz." }), [
    "Piecz.",
  ]);
  assert.deepEqual(instructionLines(["A.", { text: "B." }]), ["A.", "B."]);
  assert.deepEqual(instructionLines(null), []);
});

test("findRecipeNode ignores non-Recipe nodes around it", () => {
  assert.equal(findRecipeNode({ "@type": "WebPage" }), null);
  assert.equal(findRecipeNode([{ "@type": "Recipe", name: "x" }])?.name, "x");
});

test("readableText caps its output", () => {
  const long = `<body><main><p>${"słowo ".repeat(5000)}</p></main></body>`;
  assert.equal(readableText(long, 100).length, 100);
});
