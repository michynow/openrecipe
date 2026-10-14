import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { blobNameFor, toWebp } from "./image.ts";

/**
 * The upload is not tested — it needs the Blob token and a network. The resize
 * is, because "1200px webp" is the promise the Recipe page is built on.
 */

const image = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 60, b: 180 } },
  })
    .png()
    .toBuffer();

test("resizes a large photo down to 1200px wide webp", async () => {
  const out = await toWebp(await image(2400, 1600));
  const meta = await sharp(out).metadata();

  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 800, "keeps the aspect ratio");
});

test("never enlarges a small photo", async () => {
  const out = await toWebp(await image(600, 400));
  const meta = await sharp(out).metadata();

  assert.equal(meta.width, 600);
  assert.equal(meta.height, 400);
});

test("names the blob after the recipe's URL", () => {
  assert.equal(
    blobNameFor("https://www.kwestiasmaku.com/przepis/cukinia-zapiekana-z-feta"),
    "cukinia-zapiekana-z-feta.webp",
  );
  assert.equal(blobNameFor("https://example.test/a/b/photo.jpg"), "photo.webp");
  assert.equal(blobNameFor("https://example.test/"), "recipe.webp");
  assert.equal(blobNameFor("nonsense"), "recipe.webp");
});
