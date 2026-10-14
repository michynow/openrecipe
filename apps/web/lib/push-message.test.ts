import assert from "node:assert/strict";
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

import { buildMessage, classifyFcmError, jwtClaims, signJwt } from "./push-message.ts";

test("the JWT carries the claims and verifies against the public key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const jwt = signJwt({ client_email: "a@b.iam", private_key: privateKey, project_id: "p" }, 1000);
  const [head, body, sig] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(body, "base64url").toString()), jwtClaims("a@b.iam", 1000));
  assert.equal(jwtClaims("a@b.iam", 1000).exp, 4600);
  assert.equal(
    createVerify("RSA-SHA256")
      .update(`${head}.${body}`)
      .verify(createPublicKey(publicKey), Buffer.from(sig, "base64url")),
    true,
  );
});

test("the message targets the drafts channel and carries the draft in data", () => {
  const { message } = buildMessage("tok", "d1", "ready", "Pierogi");
  assert.equal(message.token, "tok");
  assert.equal(message.android.notification.channel_id, "drafts");
  assert.match(message.android.notification.body, /Pierogi/);
  assert.deepEqual(message.data, { draftId: "d1", status: "ready" });
  assert.doesNotMatch(buildMessage("t", "d", "failed", null).message.android.notification.body, /Pierogi/);
});

test("only dead tokens are classified for deletion", () => {
  assert.equal(classifyFcmError(200, {}), "ok");
  assert.equal(
    classifyFcmError(404, { error: { details: [{ errorCode: "UNREGISTERED" }] } }),
    "dead",
  );
  // A wrong project or a bad payload must not read as "every token is dead".
  assert.equal(classifyFcmError(404, { error: { status: "NOT_FOUND" } }), "other");
  assert.equal(classifyFcmError(400, { error: { status: "INVALID_ARGUMENT" } }), "other");
  assert.equal(classifyFcmError(401, { error: { status: "UNAUTHENTICATED" } }), "auth");
  assert.equal(classifyFcmError(500, null), "other");
});
