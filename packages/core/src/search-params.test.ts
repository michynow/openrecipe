import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseSearchFilters,
  searchApiQuery,
  searchFiltersToQuery,
  searchHref,
  toggleTag,
  type SearchFilters,
} from "./search-params.ts";

/**
 * The URL is the search page's only state, so these are the tests that stand
 * between a shared link and a view that does not match it.
 */

const empty: SearchFilters = {
  query: undefined,
  tagSlugs: [],
  maxTotalMinutes: undefined,
  hasImage: false,
};

test("nothing chosen is a bare /search", () => {
  assert.deepEqual(parseSearchFilters({}), empty);
  assert.equal(searchHref(empty), "/search");
});

test("round-trips everything a user can pick", () => {
  const filters: SearchFilters = {
    query: "żurek",
    tagSlugs: ["vegan", "lunch"],
    maxTotalMinutes: 30,
    hasImage: true,
  };
  const encoded = searchFiltersToQuery(filters);

  assert.deepEqual(parseSearchFilters(new URLSearchParams(encoded)), filters);
  // Both shapes a URL arrives in must agree — the page gets the object form.
  assert.deepEqual(
    parseSearchFilters({
      q: "żurek",
      tag: ["vegan", "lunch"],
      time: "30",
      img: "1",
    }),
    filters,
  );
});

test("the encoding is canonical, so it can key the results island", () => {
  const filters: SearchFilters = {
    query: "a",
    tagSlugs: ["vegan"],
    maxTotalMinutes: 15,
    hasImage: true,
  };
  assert.equal(
    searchFiltersToQuery(filters),
    searchFiltersToQuery({ ...filters }),
  );
  assert.equal(searchFiltersToQuery(filters), "q=a&tag=vegan&time=15&img=1");
});

test("a whitespace query is browsing, not a search for nothing", () => {
  assert.equal(parseSearchFilters({ q: "   " }).query, undefined);
  assert.equal(searchFiltersToQuery({ ...empty, query: "" }), "");
});

test("a repeated Tag is one Tag", () => {
  assert.deepEqual(
    parseSearchFilters({ tag: ["vegan", "vegan", ""] }).tagSlugs,
    ["vegan"],
  );
});

test("a hand-edited URL loses the filter rather than the page", () => {
  for (const time of ["", "0", "-30", "abc", "30.5"]) {
    assert.equal(
      parseSearchFilters({ time }).maxTotalMinutes,
      undefined,
      `expected no limit for time=${time}`,
    );
  }
  // A plausible number still applies, clamped to the editor's own ceiling.
  assert.equal(parseSearchFilters({ time: "45" }).maxTotalMinutes, 45);
  // Absurd values clamp instead of reaching the query as written.
  assert.equal(parseSearchFilters({ time: "99999" }).maxTotalMinutes, 10_080);
  assert.equal(parseSearchFilters({ time: "1e9" }).maxTotalMinutes, 10_080);
  // Anything but "1" is not an image filter — including "true" and "0".
  assert.equal(parseSearchFilters({ img: "true" }).hasImage, false);
  assert.equal(parseSearchFilters({ img: "1" }).hasImage, true);
});

test("a URL cannot ask for an unbounded number of Tags", () => {
  const many = Array.from({ length: 50 }, (_, i) => `tag-${i}`);
  assert.equal(parseSearchFilters({ tag: many }).tagSlugs.length, 20);
});

test("toggling a Tag adds it, then removes it, and leaves the rest alone", () => {
  const one = toggleTag({ ...empty, query: "x" }, "vegan");
  assert.deepEqual(one.tagSlugs, ["vegan"]);
  assert.equal(one.query, "x");

  const two = toggleTag(one, "lunch");
  assert.deepEqual(two.tagSlugs, ["vegan", "lunch"]);
  assert.deepEqual(toggleTag(two, "vegan").tagSlugs, ["lunch"]);
});

test("searchApiQuery keeps repeated tags as an array and adds the cursor", () => {
  assert.deepEqual(searchApiQuery("q=jajka&tag=a&tag=b&img=1", "c1"), {
    q: "jajka",
    tag: ["a", "b"],
    img: "1",
    cursor: "c1",
  });
});

test("searchApiQuery on browse with no cursor is empty", () => {
  assert.deepEqual(searchApiQuery("", null), {});
});
