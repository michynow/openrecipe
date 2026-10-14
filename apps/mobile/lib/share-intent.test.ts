import assert from "node:assert/strict";
import { test } from "node:test";

import { extractUrl } from "./share-intent.ts";

test("a URL alone", () => {
  assert.equal(extractUrl("https://example.com/przepis"), "https://example.com/przepis");
});

test("Chrome's Title newline URL", () => {
  assert.equal(extractUrl("Żurek babci\nhttps://example.com/zurek?a=1"), "https://example.com/zurek?a=1");
});

test("no URL", () => {
  assert.equal(extractUrl("po prostu tekst"), null);
  assert.equal(extractUrl(null), null);
  assert.equal(extractUrl(""), null);
});

test("javascript: and intent: links are refused", () => {
  assert.equal(extractUrl("javascript:alert(1)"), null);
  assert.equal(extractUrl("intent://scan/#Intent;scheme=zxing;end"), null);
});

test("trailing punctuation is trimmed", () => {
  assert.equal(extractUrl("Zobacz https://example.com/a."), "https://example.com/a");
  assert.equal(extractUrl("(https://example.com/a),"), "https://example.com/a");
});

test("a link hidden inside a javascript: call does not count", () => {
  assert.equal(extractUrl("javascript:open('https://example.com')"), null);
});
