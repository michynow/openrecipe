import { createSign } from "node:crypto";

import { copy } from "@openrecipe/core/copy";

/** The pure parts of the FCM sender: nothing here touches the network or the database. */

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type ServiceAccount = { client_email: string; private_key: string; project_id: string };

export function jwtClaims(clientEmail: string, nowSeconds: number) {
  return { iss: clientEmail, scope: FCM_SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 };
}

/** RS256-signed JWT for the OAuth jwt-bearer grant. */
export function signJwt(account: ServiceAccount, nowSeconds: number): string {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(jwtClaims(account.client_email, nowSeconds)));
  const signature = createSign("RSA-SHA256").update(`${head}.${body}`).sign(account.private_key);
  return `${head}.${body}.${b64url(signature)}`;
}

export function buildMessage(
  token: string,
  draftId: string,
  status: "ready" | "failed",
  title: string | null,
) {
  const c = copy.imports.push;
  const ready = status === "ready";
  return {
    message: {
      token,
      android: {
        // Normal priority waits for Doze's next maintenance window, which on an
        // idle phone is minutes to hours: "sometimes no push while minimised".
        priority: "HIGH",
        notification: {
          title: ready ? c.readyTitle : c.failedTitle,
          body: ready ? c.readyBody(title ?? c.untitled) : c.failedBody,
          channel_id: "drafts",
        },
      },
      data: { draftId, status },
    },
  };
}

/**
 * "dead": FCM says this device token is gone for good, delete it. Only the
 * explicit UNREGISTERED code counts: a bare 404 or INVALID_ARGUMENT is just as
 * likely a wrong project_id or a bad payload, and treating those as dead would
 * wipe every Admin's token in one run. "auth": our access token was refused.
 */
export function classifyFcmError(status: number, body: unknown): "ok" | "dead" | "auth" | "other" {
  if (status >= 200 && status < 300) return "ok";
  const error = (body as { error?: { status?: string; details?: { errorCode?: string }[] } } | null)
    ?.error;
  if (error?.details?.some((d) => d.errorCode === "UNREGISTERED")) return "dead";
  if (status === 401 || error?.status === "UNAUTHENTICATED") return "auth";
  return "other";
}
