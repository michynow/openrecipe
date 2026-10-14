import { randomBytes } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "./db/index.ts";
import { invite } from "./db/schema.ts";

/**
 * Invites. The only path to a new account.
 *
 * The important property here is that a link creates exactly one account, even
 * under a double submit or two browsers racing. That is achieved by making the
 * claim a conditional UPDATE — `usedAt` is both the record and the lock.
 */

export const INVITE_TTL_DAYS = 7;

export type InviteState =
  | "valid"
  | "unknown"
  | "expired"
  | "used"
  | "revoked"
  | "wrong-email";

/** 32 bytes of urlsafe randomness. Long enough that guessing is not a strategy. */
export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function mintInvite(opts: {
  createdById: string;
  email?: string | null;
}) {
  const token = newInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const [row] = await db
    .insert(invite)
    .values({
      token,
      email: opts.email?.trim().toLowerCase() || null,
      expiresAt,
      createdById: opts.createdById,
    })
    .returning();

  return row;
}

/**
 * Read-only check, for rendering /join before any form is shown.
 *
 * Never call this and then write based on the result — that is the read-then-write
 * race the claim function exists to avoid. This is for deciding what to display.
 */
export async function inspectInvite(
  token: string,
  email?: string | null,
): Promise<InviteState> {
  const row = await db.query.invite.findFirst({
    where: eq(invite.token, token),
  });

  if (!row) return "unknown";
  if (row.revokedAt) return "revoked";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= Date.now()) return "expired";
  if (
    row.email &&
    email &&
    row.email !== email.trim().toLowerCase()
  ) {
    return "wrong-email";
  }
  return "valid";
}

/**
 * Atomically claim an Invite.
 *
 * Returns the claimed row, or null when the claim lost — unknown token, already
 * used, revoked, expired, or another request got there first. The caller cannot
 * tell those apart on purpose: it should call `inspectInvite` for a message to
 * show, and treat a null here as "no".
 *
 * The UPDATE ... WHERE used_at IS NULL is the whole mechanism. Postgres serialises
 * concurrent updates to the same row, so exactly one of two racing requests sees a
 * row returned.
 */
export async function claimInvite(token: string, email: string) {
  const normalisedEmail = email.trim().toLowerCase();

  const claimed = await db
    .update(invite)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(invite.token, token),
        isNull(invite.usedAt),
        isNull(invite.revokedAt),
        sql`${invite.expiresAt} > now()`,
        // Honour pre-binding: a bound Invite only works for its address.
        sql`(${invite.email} is null or ${invite.email} = ${normalisedEmail})`,
      ),
    )
    .returning();

  return claimed[0] ?? null;
}

/**
 * Hand the Invite back when account creation failed after a successful claim.
 *
 * Better Auth owns user creation and does not participate in our transaction, so
 * the claim cannot be rolled back automatically. Releasing beats burning a link
 * because a password was too short.
 */
export async function releaseInvite(id: string) {
  await db
    .update(invite)
    .set({ usedAt: null })
    .where(and(eq(invite.id, id), isNull(invite.usedById)));
}

/** Record who ended up using it. Cosmetic — the claim already happened. */
export async function attributeInvite(id: string, userId: string) {
  await db.update(invite).set({ usedById: userId }).where(eq(invite.id, id));
}

export async function revokeInvite(id: string) {
  await db
    .update(invite)
    .set({ revokedAt: new Date() })
    .where(and(eq(invite.id, id), isNull(invite.usedAt)));
}
