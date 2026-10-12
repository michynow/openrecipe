import assert from "node:assert/strict";
import { test } from "node:test";

import { isUsageLimit, LIMIT_FALLBACK_MS, usageLimitRetryAt } from "./usage-limit.ts";

const NOW = new Date("2026-10-12T19:42:53Z");
const SLACK = 2 * 60_000;

test("the message from the failed Draft waits until the reset, plus slack", () => {
  const message =
    "Claude Code returned an error result: You've hit your session limit · resets 9:50pm (UTC)";
  assert.equal(isUsageLimit(message), true);
  assert.equal(usageLimitRetryAt(message, NOW)?.toISOString(), "2026-10-12T21:52:00.000Z");
});

test("a reset time already gone by today means tomorrow", () => {
  const at = usageLimitRetryAt("You've hit your session limit · resets 7am (UTC)", NOW);
  assert.equal(at?.toISOString(), "2026-10-13T07:02:00.000Z");
});

test("a laptop's local zone is honoured", () => {
  // 21:50 in Warsaw is 19:50 UTC in October (CEST).
  const at = usageLimitRetryAt("You've hit your session limit · resets 9:50pm (Europe/Warsaw)", NOW);
  assert.equal(at?.toISOString(), "2026-10-12T19:52:00.000Z");
});

test("a weekly limit with a date", () => {
  const at = usageLimitRetryAt("You've hit your weekly limit · resets Oct 15, 9pm (UTC)", NOW);
  assert.equal(at?.toISOString(), "2026-10-15T21:02:00.000Z");
});

test("the older CLI's epoch form", () => {
  const at = usageLimitRetryAt("Claude AI usage limit reached|1760306400", new Date("2025-10-12T20:00:00Z"));
  assert.equal(at?.getTime(), 1760306400 * 1000 + SLACK);
});

test("a limit with no readable reset falls back to an hour", () => {
  const at = usageLimitRetryAt("You've hit your session limit", NOW);
  assert.equal(at?.getTime(), NOW.getTime() + LIMIT_FALLBACK_MS);
  const weird = usageLimitRetryAt("You've hit your session limit · resets 9pm (Mars/Olympus)", NOW);
  assert.equal(weird?.getTime(), NOW.getTime() + LIMIT_FALLBACK_MS);
});

test("other failures are not limits", () => {
  assert.equal(usageLimitRetryAt("Reached maximum number of turns", NOW), null);
  assert.equal(usageLimitRetryAt("Invalid API key", NOW), null);
  assert.equal(usageLimitRetryAt(undefined, NOW), null);
});
