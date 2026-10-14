import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanGithubToken, dispatchFailureHint } from "./github-token.ts";

test("a cleanly pasted token is left alone", () => {
  assert.equal(cleanGithubToken("github_pat_11ABC_def"), "github_pat_11ABC_def");
  assert.equal(cleanGithubToken("ghp_abc123"), "ghp_abc123");
});

test("paste debris that makes GitHub answer 401 is stripped", () => {
  assert.equal(cleanGithubToken('"github_pat_11ABC_def"\n'), "github_pat_11ABC_def");
  assert.equal(cleanGithubToken("'ghp_abc'"), "ghp_abc");
  assert.equal(cleanGithubToken("Bearer github_pat_11ABC_def"), "github_pat_11ABC_def");
  assert.equal(cleanGithubToken("token ghp_abc"), "ghp_abc");
  assert.equal(cleanGithubToken("github_pat_11ABC\n_def "), "github_pat_11ABC_def");
});

test("an empty token is no token", () => {
  assert.equal(cleanGithubToken(undefined), undefined);
  assert.equal(cleanGithubToken(""), undefined);
  assert.equal(cleanGithubToken('  ""  '), undefined);
});

test("auth failures say what to fix; other statuses add nothing", () => {
  assert.match(dispatchFailureHint(401), /wygasł/);
  assert.match(dispatchFailureHint(403), /Contents: write/);
  assert.match(dispatchFailureHint(404), /Contents: write/);
  assert.equal(dispatchFailureHint(500), "");
});
