import assert from "node:assert/strict";
import { test } from "node:test";

import { buildUrl } from "./url.ts";

test("splits method and path", () => {
  assert.deepEqual(buildUrl("GET /api/v1/me"), { method: "GET", path: "/api/v1/me" });
});

test("substitutes and encodes params", () => {
  assert.equal(
    buildUrl("GET /api/v1/recipes/by-slug/:slug", { slug: "a b/ć" }).path,
    "/api/v1/recipes/by-slug/a%20b%2F%C4%87",
  );
});

test("repeats keys for array query values", () => {
  assert.equal(
    buildUrl("GET /api/v1/search", {}, { q: "x", tag: ["a", "b"] }).path,
    "/api/v1/search?q=x&tag=a&tag=b",
  );
});

test("throws on a missing param", () => {
  assert.throws(() => buildUrl("PUT /api/v1/recipes/:id"));
});
