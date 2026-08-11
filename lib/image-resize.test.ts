import assert from "node:assert/strict";
import { test } from "node:test";

import { fitWidth, webpName } from "./image-resize.ts";

test("scales down to the target width, keeping the ratio", () => {
  assert.deepEqual(fitWidth(4032, 3024), { width: 1200, height: 900 });
  assert.deepEqual(fitWidth(2400, 1200), { width: 1200, height: 600 });
});

test("never upscales", () => {
  assert.deepEqual(fitWidth(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitWidth(1200, 1600), { width: 1200, height: 1600 });
});

test("keeps a very tall image at least one pixel wide of height", () => {
  // A 6000x2 panorama rounds to 0 without the floor, and a zero-height canvas
  // encodes to nothing.
  assert.equal(fitWidth(6000, 2).height, 1);
});

test("swaps the extension for .webp", () => {
  assert.equal(webpName("IMG_2043.HEIC"), "IMG_2043.webp");
  assert.equal(webpName("zurek.jpeg"), "zurek.webp");
  assert.equal(webpName("bez-kropki"), "bez-kropki.webp");
  assert.equal(webpName(".gitignore"), "image.webp");
});
