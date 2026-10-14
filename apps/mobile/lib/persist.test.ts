import assert from "node:assert/strict";
import { test } from "node:test";

import { pruneRecipes, shouldPersist } from "./persist.ts";

const q = (queryKey: unknown[], status = "success", dataUpdatedAt = 0) => ({
  queryKey,
  state: { status, dataUpdatedAt },
});

test("persists successful recipe queries", () => {
  assert.equal(shouldPersist(q(["recipe", "zupa"])), true);
});

test("skips other queries", () => {
  assert.equal(shouldPersist(q(["home"])), false);
  assert.equal(shouldPersist(q(["me"])), false);
});

test("skips errored and pending recipe queries", () => {
  assert.equal(shouldPersist(q(["recipe", "zupa"], "error")), false);
  assert.equal(shouldPersist(q(["recipe", "zupa"], "pending")), false);
});

test("prunes to the newest 20 recipes", () => {
  const recipes = Array.from({ length: 25 }, (_, i) => q(["recipe", `r${i}`], "success", i));
  const kept = pruneRecipes([q(["home"]), ...recipes]);
  assert.equal(kept.length, 21);
  assert.equal(kept.some((x) => x.queryKey[1] === "r4"), false);
  assert.equal(kept.some((x) => x.queryKey[1] === "r5"), true);
  assert.equal(kept.some((x) => x.queryKey[0] === "home"), true);
});
