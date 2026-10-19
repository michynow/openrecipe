import assert from "node:assert/strict";
import { test } from "node:test";

import { isNewer, parseVersion } from "./update-logic.ts";

test("release tags parse to numbers", () => {
  assert.deepEqual(parseVersion("mobile-v1.0.10"), [1, 0, 10]);
  assert.deepEqual(parseVersion("1.2.3"), [1, 2, 3]);
  assert.equal(parseVersion("v1.2"), null);
});

test("only a strictly newer release counts, compared as numbers", () => {
  assert.equal(isNewer("mobile-v1.0.10", "1.0.9"), true);
  assert.equal(isNewer("mobile-v1.0.4", "1.0.4"), false);
  assert.equal(isNewer("mobile-v1.0.3", "1.0.4"), false);
  assert.equal(isNewer("mobile-v2.0.0", "1.9.9"), true);
  assert.equal(isNewer(null, "1.0.0"), false);
  assert.equal(isNewer("mobile-v9.9.9", undefined), false);
});
