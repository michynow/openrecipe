import assert from "node:assert/strict";
import { test } from "node:test";

import { imageSource } from "./image-source.ts";

const API = "https://app.example";
const OWN = "https://abc123.private.blob.vercel-storage.com/recipes/a.webp";

test("our blob goes through the API with the cookie", () => {
  assert.deepEqual(imageSource(OWN, API, "s=1"), {
    uri: `${API}/api/image/recipes/a.webp`,
    headers: { Cookie: "s=1" },
  });
});

test("our blob without an API_URL is no image", () => {
  assert.equal(imageSource(OWN, "", "s=1"), null);
});

test("a foreign http(s) image gets no headers at all", () => {
  assert.deepEqual(imageSource("https://cdn.example/x.jpg", API, "s=1"), { uri: "https://cdn.example/x.jpg" });
});

test("protocol-relative, other schemes and empty are no image", () => {
  for (const url of ["//evil.example/x.jpg", "/elsewhere/x.jpg", "javascript:alert(1)", "file:///x", "", null]) {
    assert.equal(imageSource(url, API, "s=1"), null, String(url));
  }
});
