import assert from "node:assert/strict";
import { test } from "node:test";

import { captionText, descriptionHasRecipe, extractFromYoutube, pickCaptionTrack, youtubeVideoId } from "./youtube.ts";

test("finds the video id in every link shape YouTube shares", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://youtube.com/shorts/${id}`,
  ]) {
    assert.equal(youtubeVideoId(url), id, url);
  }
  assert.equal(youtubeVideoId("https://www.kwestiasmaku.com/przepis/x"), null);
  assert.equal(youtubeVideoId("https://www.youtube.com/@channel"), null);
});

test("a description with an ingredient list counts as a recipe; chapters do not", () => {
  assert.equal(descriptionHasRecipe("Składniki:\n500 g mąki\n2 jajka\n- 1 łyżka cukru"), true);
  assert.equal(descriptionHasRecipe("0:00 Wstęp\n0:22 Mięso\n6:30 Bułka\n8:00 Podanie"), false);
  assert.equal(descriptionHasRecipe("Zapraszam na nowy odcinek! Subskrybuj 🙂\n2024"), false);
  assert.equal(descriptionHasRecipe("Składniki:\n-łopatka wieprzowa\n-papryka, czosnek\n-sos bbq"), true);
  assert.equal(descriptionHasRecipe("Składniki:\n-łopatka\n\nSubskrybuj!"), false);
});

test("own Polish captions beat auto ones, auto ones beat foreign manual ones", () => {
  const pl = { baseUrl: "pl", languageCode: "pl" };
  const asr = { baseUrl: "asr", languageCode: "en", kind: "asr" };
  const de = { baseUrl: "de", languageCode: "de" };
  assert.equal(pickCaptionTrack([de, asr, pl]), pl);
  assert.equal(pickCaptionTrack([de, asr]), asr);
  assert.equal(pickCaptionTrack([de]), de);
  assert.equal(pickCaptionTrack([]), null);
});

test("caption XML becomes one line of plain text", () => {
  const xml = `<?xml version="1.0"?><timedtext format="3"><body>
<p t="0">[Muzyka]</p><p t="10"><s>Dodaj</s><s> dwa</s></p><p t="20">jajka &amp; mąkę</p></body></timedtext>`;
  assert.equal(captionText(xml), "Dodaj dwa jajka & mąkę");
});

test("LOGIN_REQUIRED falls back to the Data API description", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) =>
    Response.json(
      url.includes("googleapis.com")
        ? { items: [{ snippet: { title: "Pierogi", description: "500 g mąki\n2 jajka\n1 łyżka soli", channelTitle: "Kuchnia" } }] }
        : { playabilityStatus: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" } },
    ),
  );
  t.after(() => delete process.env.YOUTUBE_API_KEY);
  process.env.YOUTUBE_API_KEY = "test-key";
  const result = await extractFromYoutube("dQw4w9WgXcQ");
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.page.text?.includes("500 g mąki"));
  assert.ok(result.ok && result.page.author === "Kuchnia");
});
