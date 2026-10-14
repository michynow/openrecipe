import assert from "node:assert/strict";
import { test } from "node:test";

import { effectiveRole, isMasterEmail, roleFor } from "./roles.ts";

const MASTER = "michy.now@gmail.com";

test("the configured email is Master", () => {
  assert.equal(isMasterEmail(MASTER, MASTER), true);
  assert.equal(roleFor(MASTER, MASTER), "master");
});

test("anyone else is a Member", () => {
  assert.equal(isMasterEmail("kasia@example.com", MASTER), false);
  assert.equal(roleFor("kasia@example.com", MASTER), "member");
});

test("comparison ignores case and surrounding whitespace", () => {
  // Google hands back whatever casing the user typed at signup
  assert.equal(isMasterEmail("Michy.Now@Gmail.com", MASTER), true);
  assert.equal(isMasterEmail("  michy.now@gmail.com  ", MASTER), true);
  assert.equal(isMasterEmail(MASTER, "  MICHY.NOW@GMAIL.COM "), true);
});

test("a blank or missing MASTER_EMAIL makes nobody Master, not everybody", () => {
  // Failing closed is the point: a misconfigured environment must not hand out
  // Master to the first person who signs in with an empty email.
  assert.equal(isMasterEmail("", ""), false);
  assert.equal(isMasterEmail("anyone@example.com", ""), false);
  assert.equal(isMasterEmail("anyone@example.com", undefined), false);
  assert.equal(isMasterEmail("anyone@example.com", null), false);
  assert.equal(isMasterEmail("anyone@example.com", "   "), false);
  assert.equal(roleFor("anyone@example.com", ""), "member");
});

test("null and undefined emails are never Master", () => {
  assert.equal(isMasterEmail(null, MASTER), false);
  assert.equal(isMasterEmail(undefined, MASTER), false);
});

test("a near-miss address is not Master", () => {
  assert.equal(isMasterEmail("michy.now@gmail.co", MASTER), false);
  assert.equal(isMasterEmail("michy.now+alias@gmail.com", MASTER), false);
  assert.equal(isMasterEmail("michynow@gmail.com", MASTER), false);
});

test("the stored column grants admin, never master", () => {
  assert.equal(effectiveRole("kasia@example.com", "admin", MASTER), "admin");
  assert.equal(effectiveRole("kasia@example.com", "member", MASTER), "member");
  // A stale or forged "master" in the column is just a member.
  assert.equal(effectiveRole("kasia@example.com", "master", MASTER), "member");
  assert.equal(effectiveRole("kasia@example.com", null, MASTER), "member");
  // MASTER_EMAIL wins whatever the column says.
  assert.equal(effectiveRole(MASTER, "member", MASTER), "master");
});
