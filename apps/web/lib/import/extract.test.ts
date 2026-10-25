import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  extractFromHtml,
  findRecipeNode,
  instructionLines,
  ingredientEntries,
  isoDurationToMinutes,
  readableText,
  sectionName,
  sectionsFromMarkup,
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
  // A plain list: no Sections invented.
  assert.deepEqual(page.ingredients, [
    { text: "1 kg ziemniaków", section: null },
    { text: "2 jajka", section: null },
    { text: "1 cebula", section: null },
  ]);
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
  // Headings smuggled into recipeIngredient become Sections, not ingredients.
  assert.deepEqual(page.ingredients, [
    { text: "1 szczypta soli", section: null },
    { text: "500 g dyni", section: "Baza" },
    { text: "1 l bulionu", section: "Baza" },
    { text: "100 ml śmietanki", section: "Do podania" },
    { text: "2 łyżki pestek dyni", section: "Posypka" },
  ]);
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

test("a camelCase …StickySidebar wrapper is content, not a sidebar", () => {
  const recipe = "Kurki podsmaż na maśle, wyłóż na twaróg z koperkiem. ".repeat(20);
  const html = `<body><div class="theiaStickySidebar"><p>${recipe}</p><div class="comments">Super przepis!</div></div></body>`;
  const text = readableText(html);
  assert.ok(text.includes("Kurki podsmaż"));
  assert.ok(!text.includes("Super przepis"));
});

test("readableText caps its output", () => {
  const long = `<body><main><p>${"słowo ".repeat(5000)}</p></main></body>`;
  assert.equal(readableText(long, 100).length, 100);
});

test("reads ingredient Sections from the page's markup when JSON-LD is flat", () => {
  const result = extractFromHtml(fixture("html-ingredient-groups.html"));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(
    result.page.ingredients.map((entry) => [entry.section, entry.text]),
    [
      ["Bułki", "500 g mąki"],
      ["Bułki", "7 g drożdży"],
      ["Kotlety", "500 g wołowiny"],
      // Bold, but an ingredient: it does not start a Section of its own.
      ["Kotlety", "sól"],
      ["Surówka", "1 ogórek"],
      ["Surówka", "2 łyżki majonezu"],
    ],
  );
});

test("one heading over every line is not a grouping", () => {
  const html = "<h2>Zupa</h2><ul><li>woda</li><li>sól</li></ul>";
  assert.deepEqual(sectionsFromMarkup(html, ["woda", "sól"]), [null, null]);
});

test("section names: 'Składniki na X' is X, bare 'Składniki' is nothing", () => {
  assert.equal(sectionName("Składniki na ciasto:"), "Ciasto");
  assert.equal(sectionName("Składniki na 4 porcje"), null);
  assert.equal(sectionName("SKŁADNIKI"), null);
  assert.equal(sectionName("--- Sos ---"), "Sos");
});

test("heading-looking entries stay ingredients unless a quantified line follows", () => {
  const long = "Świeżo mielony czarny pieprz z młynka albo z moździerza, do smaku:";
  const entries = ingredientEntries([
    "SÓL",
    "pieprz",
    "<b>oliwa</b>",
    "natka pietruszki:",
    long,
    "1 cebula",
    "SOS",
    "2 pomidory",
    "BAZYLIA",
  ]);
  assert.deepEqual(
    entries.map((e) => [e.section, e.text]),
    [
      [null, "SÓL"],
      [null, "pieprz"],
      [null, "oliwa"],
      [null, "natka pietruszki:"],
      // Over 60 characters: never a Section name, never dropped.
      [null, long],
      [null, "1 cebula"],
      ["SOS", "2 pomidory"],
      // Last entry: nothing quantified follows, so it is an ingredient.
      ["SOS", "BAZYLIA"],
    ],
  );
});

test("a bold quantity in the markup is not a Section", () => {
  const html =
    "<h3>Ciasto</h3><ul><li>mąka</li><li><strong>1 cebula</strong></li><li>sól</li></ul>" +
    "<h3>Sos</h3><ul><li>woda</li></ul>";
  // "cebula drobno" matches no <li>, so the bold "1 cebula" is seen only as a heading candidate.
  assert.deepEqual(sectionsFromMarkup(html, ["mąka", "cebula drobno", "sól", "woda"]), [
    "Ciasto",
    "Ciasto",
    "Ciasto",
    "Sos",
  ]);
});
