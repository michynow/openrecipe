import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "@openrecipe/core/copy";

import { pulseMap, pulseToasts } from "./pulse.ts";

const waiting = pulseMap([{ id: "a", status: "queued", title: null }]);

test("the first poll is a baseline", () => {
  assert.deepEqual(pulseToasts(null, [{ id: "a", status: "ready", title: "Zupa" }], null), []);
});

test("ready opens the review, failed opens the list", () => {
  const [ready] = pulseToasts(waiting, [{ id: "a", status: "ready", title: "Zupa" }], null);
  assert.equal(ready.message, copy.imports.toastReady("Zupa"));
  assert.equal(ready.href, "/drafts/a");
  const [failed] = pulseToasts(waiting, [{ id: "a", status: "failed", title: null }], null);
  assert.equal(failed.message, copy.imports.toastFailed);
  assert.equal(failed.href, "/drafts");
});

test("still waiting, or already seen done: nothing", () => {
  assert.deepEqual(pulseToasts(waiting, [{ id: "a", status: "processing", title: null }], null), []);
  const done = pulseMap([{ id: "a", status: "ready", title: null }]);
  assert.deepEqual(pulseToasts(done, [{ id: "a", status: "ready", title: null }], null), []);
});

test("the Draft open in review is skipped", () => {
  assert.deepEqual(pulseToasts(waiting, [{ id: "a", status: "ready", title: "Zupa" }], "a"), []);
});
