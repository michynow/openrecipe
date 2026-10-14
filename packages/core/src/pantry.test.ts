import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePantry, today } from "./pantry.ts";

test("reads back the ticks stored today", () => {
  const raw = JSON.stringify({ date: "2026-07-27", checked: ["a", "b"] });
  assert.deepEqual(parsePantry(raw, "2026-07-27"), ["a", "b"]);
});

test("an entry from another day is discarded", () => {
  const raw = JSON.stringify({ date: "2026-07-26", checked: ["a", "b"] });
  assert.deepEqual(parsePantry(raw, "2026-07-27"), []);
});

test("nothing stored, or nonsense stored, starts clean", () => {
  assert.deepEqual(parsePantry(null, "2026-07-27"), []);
  assert.deepEqual(parsePantry("", "2026-07-27"), []);
  assert.deepEqual(parsePantry("{not json", "2026-07-27"), []);
  assert.deepEqual(parsePantry("null", "2026-07-27"), []);
  assert.deepEqual(parsePantry('{"date":"2026-07-27"}', "2026-07-27"), []);
  assert.deepEqual(
    parsePantry('{"date":"2026-07-27","checked":[1,null,"a"]}', "2026-07-27"),
    ["a"],
  );
});

test("today is a local ISO date", () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});
