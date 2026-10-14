import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeCursor, encodeCursor } from "./search-query.ts";

/**
 * Only the cursor is testable without a database, and it is the part worth
 * testing: it is the difference between infinite scroll that skips a Recipe and
 * one that does not. The SQL is verified against the real database instead.
 */

const position = {
  createdAt: "2026-07-30 09:15:22.481",
  id: "1e0b9d4a-5f2c-4a1e-9c3b-77c4b8a1d0f2",
};

test("round-trips a browse position", () => {
  assert.deepEqual(decodeCursor(encodeCursor(position)), position);
});

test("round-trips a search position, score and all", () => {
  const withScore = { score: 0.625, ...position };
  assert.deepEqual(decodeCursor(encodeCursor(withScore)), withScore);
});

test("survives a URL round trip", () => {
  const encoded = encodeCursor(position);
  assert.equal(encoded, encodeURIComponent(encoded));
});

test("garbage restarts the scroll instead of throwing", () => {
  for (const value of [
    null,
    undefined,
    "",
    "not-base64-at-all!!",
    Buffer.from("[]").toString("base64url"),
    Buffer.from('{"id":"x"}').toString("base64url"),
    Buffer.from('{"createdAt":"x","id":"y","score":"high"}').toString(
      "base64url",
    ),
    encodeCursor(position).slice(0, -4),
    // Would reach Postgres as `'today'::timestamp` / `'sql'::uuid` and raise.
    encodeCursor({ ...position, createdAt: "today" }),
    encodeCursor({ ...position, id: "'; drop table recipe --" }),
    encodeCursor({ ...position, score: Number.NaN }),
  ]) {
    assert.equal(decodeCursor(value), null, `expected null for ${value}`);
  }
});
