import assert from "node:assert/strict";
import { test } from "node:test";

import { SEED_TAGS, TAG_SLUG } from "./tags.ts";

test("TAG_SLUG accepts every seeded slug and refuses the rest", () => {
  for (const { slug } of SEED_TAGS) assert.match(slug, TAG_SLUG, slug);
  for (const bad of ["", "a", "Vegan", "1pot", "-x", "with space", "polski-żurek", "x".repeat(41)]) {
    assert.doesNotMatch(bad, TAG_SLUG, bad);
  }
});
