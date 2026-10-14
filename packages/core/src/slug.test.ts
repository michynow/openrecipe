import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify, uniqueSlug } from "./slug.ts";

test("transliterates Polish diacritics", () => {
  assert.equal(slugify("Żurek"), "zurek");
  assert.equal(slugify("Śledź w oleju"), "sledz-w-oleju");
  assert.equal(slugify("Gęś z jabłkami"), "ges-z-jablkami");
  assert.equal(slugify("Ćwikła"), "cwikla");
});

test("handles ł, which decomposition does not touch", () => {
  // Ł is its own letter, not L with a diacritic — NFD leaves it intact.
  assert.equal(slugify("Łosoś"), "losos");
  assert.equal(slugify("Kluski śląskie"), "kluski-slaskie");
});

test("handles other European letters", () => {
  assert.equal(slugify("Ragù alla bolognese"), "ragu-alla-bolognese");
  assert.equal(slugify("Crème brûlée"), "creme-brulee");
  assert.equal(slugify("Smørrebrød"), "smorrebrod");
});

test("collapses punctuation and whitespace", () => {
  assert.equal(slugify("Pierogi (ruskie!)"), "pierogi-ruskie");
  assert.equal(slugify("  Zupa   pomidorowa  "), "zupa-pomidorowa");
  assert.equal(slugify("Kurczak & ryż"), "kurczak-ryz");
  assert.equal(slugify("50/50 pizza"), "50-50-pizza");
});

test("never returns an empty slug", () => {
  assert.equal(slugify("!!!"), "przepis");
  assert.equal(slugify("   "), "przepis");
  // Non-Latin script transliterates to nothing here, which is acceptable —
  // the numeric suffix keeps such recipes distinguishable.
  assert.equal(slugify("寿司"), "przepis");
});

test("caps length without leaving a trailing hyphen", () => {
  const slug = slugify("a".repeat(100) + " " + "b".repeat(20));
  assert.ok(slug.length <= 80, `length was ${slug.length}`);
  assert.ok(!slug.endsWith("-"), `ended with hyphen: ${slug}`);
});

test("uniqueSlug returns the base when free", async () => {
  assert.equal(await uniqueSlug("Żurek", async () => false), "zurek");
});

test("uniqueSlug suffixes on collision", async () => {
  const existing = new Set(["zurek", "zurek-2", "zurek-3"]);
  assert.equal(
    await uniqueSlug("Żurek", async (c) => existing.has(c)),
    "zurek-4",
  );
});

test("uniqueSlug asks about each candidate in turn", async () => {
  const asked: string[] = [];
  await uniqueSlug("Ragù", async (c) => {
    asked.push(c);
    return asked.length < 3;
  });
  assert.deepEqual(asked, ["ragu", "ragu-2", "ragu-3"]);
});
