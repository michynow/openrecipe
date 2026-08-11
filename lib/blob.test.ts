import assert from "node:assert/strict";
import { test } from "node:test";

import { blobPathname, imageSrc, isOwnBlobUrl } from "./blob.ts";

const OURS = "https://ew7dfgvrfkirdliu.private.blob.vercel-storage.com/zurek-a1b2.webp";

test("recognises a blob in our store", () => {
  assert.equal(blobPathname(OURS), "zurek-a1b2.webp");
  assert.equal(isOwnBlobUrl(OURS), true);
});

test("refuses anything that is not our store", () => {
  // A Worker-imported Recipe keeps its source site's image URL, and a Server
  // Action must never be talked into deleting something off it.
  assert.equal(blobPathname("https://kwestiasmaku.com/img/zurek.jpg"), null);
  assert.equal(blobPathname("http://x.blob.vercel-storage.com/a.webp"), null);
  assert.equal(blobPathname("https://blob.vercel-storage.com.evil.test/a.webp"), null);
  assert.equal(blobPathname("javascript:alert(1)"), null);
  assert.equal(blobPathname("not a url"), null);
  assert.equal(blobPathname(null), null);
});

test("a store URL with no object path addresses nothing", () => {
  assert.equal(blobPathname("https://x.private.blob.vercel-storage.com/"), null);
});

test("routes our blobs through the proxy and leaves others alone", () => {
  assert.equal(imageSrc(OURS), "/api/image/zurek-a1b2.webp");
  assert.equal(imageSrc(null), null);

  const foreign = "https://kwestiasmaku.com/img/zurek.jpg";
  assert.equal(imageSrc(foreign), foreign);
});

test("keeps folders, escapes the segments", () => {
  const url =
    "https://x.private.blob.vercel-storage.com/2026/zupa%20%C5%BCurek.webp";
  assert.equal(blobPathname(url), "2026/zupa żurek.webp");
  assert.equal(imageSrc(url), "/api/image/2026/zupa%20%C5%BCurek.webp");
});
