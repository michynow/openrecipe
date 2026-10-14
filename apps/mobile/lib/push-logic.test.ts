import assert from "node:assert/strict";
import { test } from "node:test";

import { draftRoute, isUuid, shouldRegister } from "./push-logic.ts";

const id = "0b9f4c1e-8d3a-4e57-9a61-2c7d5e8f1a30";

test("only uuids open a draft", () => {
  assert.equal(isUuid(id), true);
  for (const bad of ["", "../account", `${id}/x`, "abc", 7, null, undefined]) assert.equal(isUuid(bad), false);
});

test("draftRoute reads data.draftId and nothing else", () => {
  assert.equal(draftRoute({ draftId: id, status: "ready" }), `/drafts/${id}`);
  assert.equal(draftRoute({ draftId: "/account" }), null);
  assert.equal(draftRoute({ url: "https://evil.example" }), null);
  assert.equal(draftRoute(null), null);
});

test("shouldRegister skips the stored token and empties", () => {
  assert.equal(shouldRegister("tok", null), true);
  assert.equal(shouldRegister("tok", "old"), true);
  assert.equal(shouldRegister("tok", "tok"), false);
  assert.equal(shouldRegister("", null), false);
  assert.equal(shouldRegister(undefined, null), false);
});
