import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertReady,
  assertTransition,
  canTransition,
  DRAFT_STATUSES,
  isDraftStatus,
  isQueueExpired,
  isReclaimable,
  parseDraftPayload,
  QUEUE_MAX_MS,
  RECLAIM_AFTER_MS,
  sourceUrlSchema,
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

test("a parked link that is not a URL is rejected, not thrown at", () => {
  // Regression: `.url()` followed by a refinement reading new URL(value) threw
  // TypeError out of the parse, because Zod 4 keeps running later checks after
  // an earlier one fails. That reached the user as a crashed Server Action.
  assert.equal(sourceUrlSchema.safeParse("nie-jest-linkiem").success, false);
  assert.equal(sourceUrlSchema.safeParse("").success, false);
  assert.equal(sourceUrlSchema.safeParse("javascript:alert(1)").success, false);
  assert.equal(sourceUrlSchema.safeParse("ftp://example.com/x").success, false);

  const ok = sourceUrlSchema.safeParse(
    "  https://www.kwestiasmaku.com/przepis/zurek  ",
  );
  assert.equal(ok.success && ok.data, "https://www.kwestiasmaku.com/przepis/zurek");
});

test("isDraftStatus rejects anything not in the model", () => {
  assert.equal(isDraftStatus("ready"), true);
  assert.equal(isDraftStatus("banana"), false);
  assert.equal(isDraftStatus(undefined), false);
});

test("a queued Draft expires after QUEUE_MAX_MS, and only a queued one", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const fresh = new Date(now.getTime() - QUEUE_MAX_MS + 1000);
  const stale = new Date(now.getTime() - QUEUE_MAX_MS);

  assert.equal(isQueueExpired("queued", fresh, now), false);
  assert.equal(isQueueExpired("queued", stale, now), true);
  assert.equal(isQueueExpired("processing", stale, now), false);
  assert.equal(canTransition("queued", "failed"), true);
});
