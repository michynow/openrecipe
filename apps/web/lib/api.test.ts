import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import type { Invite } from "@openrecipe/core/api";

import { fail, jsonBody, readCapped, uuid, type Wire } from "./api.ts";

const schema = z.object({ n: z.number() });
const post = (body: string, type?: string) =>
  new Request("http://x/api/v1/t", {
    method: "POST",
    body,
    headers: type ? { "content-type": type } : {},
  });

test("rejects a non-JSON content type", async () => {
  const res = await jsonBody(post('{"n":1}', "text/plain"), schema);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 400);
});

test("rejects an invalid body with issues", async () => {
  const res = await jsonBody(post('{"n":"x"}', "application/json"), schema);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "bad-request");
  assert.ok(Array.isArray(body.issues) && body.issues.length > 0);
});

test("rejects unparseable JSON", async () => {
  const res = await jsonBody(post("{", "application/json"), schema);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 400);
});

test("accepts a valid body, charset suffix included", async () => {
  const res = await jsonBody(post('{"n":1}', "application/json; charset=utf-8"), schema);
  assert.deepEqual(res, { n: 1 });
});

test("fail carries status and code", async () => {
  const res = fail(403, "forbidden");
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "forbidden" });
});

test("uuid passes a uuid and 404s anything else", async () => {
  const id = "0b9e7a52-3c1d-4f0e-9a6b-2d5c8e1f7a90";
  assert.equal(uuid(id), id);
  assert.equal(uuid(id.toUpperCase()), id.toUpperCase());

  for (const junk of ["", "42", "not-a-uuid", `${id}x`, "../etc/passwd"]) {
    const res = uuid(junk);
    assert.ok(res instanceof Response, junk);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "not-found" });
  }
});

// Type-level: checked by `tsc`, not at runtime. Only branded Iso fields take a Date.
const now = new Date();
export const wireAcceptsDateForIso: Wire<Invite> = {
  id: "i", token: "t", email: null, expiresAt: now, usedAt: null, revokedAt: now, expired: false,
};
// @ts-expect-error — `token` is a plain string, not Iso
export const wireRejectsDateForString: Wire<Invite> = { ...wireAcceptsDateForIso, token: now };

test("readCapped returns the body under the cap and null over it", async () => {
  const body = (n: number, headers: Record<string, string> = {}) =>
    new Request("http://x/api/v1/images", { method: "POST", body: new Uint8Array(n), headers });

  assert.equal((await readCapped(body(10), 10))?.byteLength, 10);
  assert.equal(await readCapped(body(11), 10), null);
  // A lying Content-Length is refused before reading; a missing one is counted.
  assert.equal(await readCapped(body(1, { "content-length": "999" }), 10), null);
});
