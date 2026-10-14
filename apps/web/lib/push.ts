import { and, eq, inArray } from "drizzle-orm";

import { db } from "./db/index.ts";
import { pushToken, user } from "./db/schema.ts";
import {
  buildMessage,
  classifyFcmError,
  signJwt,
  TOKEN_URL,
  type ServiceAccount,
} from "./push-message.ts";
import { effectiveRole } from "./roles.ts";

/**
 * Android push through Firebase Cloud Messaging HTTP v1, no SDK. Best-effort
 * like lib/kitchen.ts: notifyDraftFinished never throws, so a push problem can
 * never fail the Worker.
 */

export async function savePushToken(userId: string, token: string): Promise<void> {
  await db
    .insert(pushToken)
    .values({ userId, token })
    .onConflictDoUpdate({ target: pushToken.token, set: { userId, updatedAt: new Date() } });
}

export async function deletePushToken(userId: string, token: string): Promise<void> {
  await db.delete(pushToken).where(and(eq(pushToken.token, token), eq(pushToken.userId, userId)));
}

let warned = false;
let cached: { value: string; expiresAt: number } | null = null;

function account(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as ServiceAccount;
      if (parsed.client_email && parsed.private_key && parsed.project_id) return parsed;
    }
  } catch {
    // fall through to the one-time warning
  }
  if (!warned) {
    warned = true;
    console.warn("push: FIREBASE_SERVICE_ACCOUNT missing or invalid, notifications are off");
  }
  return null;
}

async function accessToken(acc: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.value;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signJwt(acc, Math.floor(now / 1000)),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`token exchange HTTP ${response.status}`);
  const { access_token, expires_in } = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cached = { value: access_token, expiresAt: now + expires_in * 1000 };
  return access_token;
}

export async function notifyDraftFinished(
  draftId: string,
  status: "ready" | "failed",
  title: string | null,
): Promise<void> {
  try {
    const acc = account();
    if (!acc) return;

    // Drafts are Admin-only: a token whose owner has since been demoted stays in
    // the table (it is theirs to delete) but gets no Draft titles.
    const rows = (
      await db
        .select({ token: pushToken.token, email: user.email, role: user.role })
        .from(pushToken)
        .innerJoin(user, eq(pushToken.userId, user.id))
    ).filter((r) => effectiveRole(r.email, r.role) !== "member");
    if (rows.length === 0) return;

    const bearer = await accessToken(acc);
    const dead: string[] = [];
    await Promise.all(
      rows.map(async ({ token }) => {
        try {
          const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`,
            {
              method: "POST",
              headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
              body: JSON.stringify(buildMessage(token, draftId, status, title)),
              signal: AbortSignal.timeout(10_000),
            },
          );
          const body = response.ok ? null : await response.json().catch(() => null);
          const verdict = classifyFcmError(response.status, body);
          if (verdict === "dead") dead.push(token);
          // Revoked key or clock skew: fetch a fresh access token next time.
          if (verdict === "auth") cached = null;
        } catch (e) {
          console.warn("push: send failed", (e as Error).message);
        }
      }),
    );

    if (dead.length) await db.delete(pushToken).where(inArray(pushToken.token, dead));
  } catch (e) {
    console.warn("push: failed", (e as Error).message);
  }
}
