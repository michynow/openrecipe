import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertReady,
  assertTransition,
  canTransition,
  DRAFT_STATUSES,
  isDraftStatus,
  isReclaimable,
  parseDraftPayload,
  RECLAIM_AFTER_MS,
} from "./drafts.ts";

const validPayload = {
  title: "Żurek",
  servings: 4,
  totalMinutes: null,
  kcalPerServing: null,
  sourceUrl: null,
  imageUrl: null,
  ingredientLines: [
    { quantity: 2, unit: "szklanki", item: "zakwas", note: null, substitutes: [] },
  ],
  steps: ["Zagotuj wywar."],
  tips: [],
  tagSlugs: [],
};

test("the happy path runs queued to approved", () => {
  assert.equal(canTransition("queued", "processing"), true);
  assert.equal(canTransition("processing", "ready"), true);
  assert.equal(canTransition("ready", "approved"), true);
});

test("approved and discarded are terminal", () => {
  for (const to of DRAFT_STATUSES) {
    assert.equal(canTransition("approved", to), false);
    assert.equal(canTransition("discarded", to), false);
  }
});

test("refuses the moves that would skip review", () => {
  // The whole point of the model: nothing becomes a Recipe unapproved.
  assert.equal(canTransition("queued", "approved"), false);
  assert.equal(canTransition("processing", "approved"), false);
  assert.equal(canTransition("failed", "ready"), false);
});

test("retry and reclaim go back to queued", () => {
  assert.equal(canTransition("failed", "queued"), true);
  assert.equal(canTransition("ready", "queued"), true);
  assert.equal(canTransition("processing", "queued"), true);
});

test("assertTransition throws on an illegal move and names both ends", () => {
  assert.throws(
    () => assertTransition("approved", "queued"),
    /approved -> queued/,
  );
  assertTransition("queued", "processing");
});

test("only a stale claim is reclaimable", () => {
  const now = new Date("2026-08-11T12:00:00Z");
  const fresh = new Date(now.getTime() - RECLAIM_AFTER_MS + 1000);
  const stale = new Date(now.getTime() - RECLAIM_AFTER_MS);

  assert.equal(isReclaimable("processing", fresh, now), false);
  assert.equal(isReclaimable("processing", stale, now), true);
  // A processing row that was never claimed cannot be waited on forever.
  assert.equal(isReclaimable("processing", null, now), true);
  // Nothing else is ever reclaimable, however old.
  assert.equal(isReclaimable("queued", stale, now), false);
  assert.equal(isReclaimable("ready", stale, now), false);
});

test("payload is validated with the shared Recipe schema", () => {
  assert.equal(parseDraftPayload(validPayload)?.title, "Żurek");
  assert.equal(parseDraftPayload({ ...validPayload, steps: [] }), null);
  assert.equal(parseDraftPayload(null), null);
});

test("ready demands a payload", () => {
  assert.throws(() => assertReady(null), /valid payload/);
  assert.equal(assertReady(validPayload).servings, 4);
});

test("isDraftStatus rejects anything not in the model", () => {
  assert.equal(isDraftStatus("ready"), true);
  assert.equal(isDraftStatus("banana"), false);
  assert.equal(isDraftStatus(undefined), false);
});
