import assert from "node:assert/strict";
import { test } from "node:test";

import { extractJson, validate } from "./generate.ts";
import { ingredientList } from "./prompt.ts";

/**
 * The model call itself is not tested — it needs the laptop's Claude
 * subscription and a network. What is tested is everything that decides whether
 * to trust the answer, which is where the bugs would be.
 */

const ALLOWED = new Set(["dinner", "polish", "vegetarian"]);

const answer = (over: Record<string, unknown> = {}) => ({
  title: "Żurek",
  servings: 4,
  totalMinutes: 60,
  kcalPerServing: null,
  ingredientLines: [
    {
      quantity: 2,
      unit: "szklanki",
      item: "zakwas na żurek",
      note: null,
      substitutes: [{ item: "zakwas z chleba", note: "łagodniejszy" }],
    },
  ],
  steps: ["Zagotuj wywar.", "Wlej zakwas."],
  tips: [],
  tagSlugs: ["dinner", "polish"],
  inferred: ["servings"],
  ...over,
});

test("takes the JSON out of a fenced answer", () => {
  const parsed = extractJson('Sure!\n```json\n{"a":1}\n```\n');
  assert.deepEqual(parsed, { a: 1 });
});

test("takes the JSON out of a bare answer with a sentence in front", () => {
  assert.deepEqual(extractJson('Here you go: {"a":[1,2]} hope that helps'), {
    a: [1, 2],
  });
});

test("returns null when there is no object at all", () => {
  assert.equal(extractJson("I could not read that page."), null);
  assert.equal(extractJson("{ not json }"), null);
});

test("accepts a well-formed answer and keeps the inferred list apart", () => {
  const result = validate(answer(), ALLOWED);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.payload.title, "Żurek");
  assert.deepEqual(result.inferred, ["servings"]);
  // `inferred` is not part of a Recipe and must not survive into the payload.
  assert.equal("inferred" in result.payload, false);
});

test("rejects an invented tag by name, so the retry can fix it", () => {
  const result = validate(answer({ tagSlugs: ["dinner", "zupy"] }), ALLOWED);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors[0], /zupy/);
});

test("rejects an answer that breaks the Recipe schema", () => {
  const noSteps = validate(answer({ steps: [] }), ALLOWED);
  assert.equal(noSteps.ok, false);

  const noIngredients = validate(answer({ ingredientLines: [] }), ALLOWED);
  assert.equal(noIngredients.ok, false);

  const sixTags = validate(
    answer({ tagSlugs: ["dinner", "polish", "vegetarian", "a", "b", "c"] }),
    ALLOWED,
  );
  assert.equal(sixTags.ok, false);
});

test("an answer that is not an object is a schema failure, not a crash", () => {
  assert.equal(validate(null, ALLOWED).ok, false);
  assert.equal(validate("żurek", ALLOWED).ok, false);
  assert.equal(validate([1, 2, 3], ALLOWED).ok, false);
});

test("the model's Sections survive validation, regrouped contiguous", () => {
  const line = (item: string, section: string | null) => ({ quantity: null, unit: null, item, note: null, section, substitutes: [] });
  const result = validate(
    answer({ ingredientLines: [line("mąka", "Ciasto"), line("pomidory", "Sos"), line("jajko", "Ciasto")] }),
    ALLOWED,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.payload.ingredientLines.map((l) => [l.section, l.item]),
    [
      ["Ciasto", "mąka"],
      ["Ciasto", "jajko"],
      ["Sos", "pomidory"],
    ],
  );
});

test("the prompt shows the page's Sections as headings", () => {
  const text = ingredientList({
    ingredients: [
      { text: "sól", section: null },
      { text: "500 g mąki", section: "Ciasto" },
      { text: "1 jajko", section: "Ciasto" },
    ],
  } as Parameters<typeof ingredientList>[0]);
  assert.equal(text, "- sól\n## Ciasto\n- 500 g mąki\n- 1 jajko");
});
