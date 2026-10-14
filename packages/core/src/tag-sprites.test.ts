import assert from "node:assert/strict";
import { test } from "node:test";

import { SEED_TAGS } from "./tags.ts";
import { spriteProblem } from "./pixel.ts";
import { TAG_SPRITES } from "./tag-sprites.ts";

test("every tag sprite is 12×12 and uses only palette letters", () => {
  for (const [slug, rows] of Object.entries(TAG_SPRITES)) {
    assert.equal(spriteProblem(rows), null, slug);
  }
});

test("every seeded Tag has a sprite, and no sprite is for a Tag that does not exist", () => {
  const seeded = new Set(SEED_TAGS.map((tag) => tag.slug));
  assert.deepEqual(SEED_TAGS.filter((tag) => !TAG_SPRITES[tag.slug]).map((tag) => tag.slug), []);
  assert.deepEqual(Object.keys(TAG_SPRITES).filter((slug) => !seeded.has(slug)), []);
});
