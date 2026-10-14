import assert from "node:assert/strict";
import { test } from "node:test";

import { fitWidth, SessionUploads } from "./upload.ts";

test("fitWidth shrinks wide pictures and never upscales", () => {
  assert.equal(fitWidth(4000, 1200), 1200);
  assert.equal(fitWidth(1200, 1200), null);
  assert.equal(fitWidth(600, 1200), null);
});

test("SessionUploads only releases what this session uploaded, once", () => {
  const s = new SessionUploads();
  s.add("https://x/a.webp");
  assert.equal(s.take("https://x/old.webp"), false);
  assert.equal(s.take(null), false);
  assert.equal(s.take("https://x/a.webp"), true);
  assert.equal(s.take("https://x/a.webp"), false);
});

test("SessionUploads.drain hands over everything once; clear keeps nothing to delete", () => {
  const s = new SessionUploads();
  s.add("https://x/a.webp");
  s.add("https://x/b.webp");
  assert.deepEqual(s.drain().sort(), ["https://x/a.webp", "https://x/b.webp"]);
  assert.deepEqual(s.drain(), []);
  s.add("https://x/c.webp");
  s.clear();
  assert.deepEqual(s.drain(), []);
});
