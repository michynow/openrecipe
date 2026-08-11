import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "./auth.ts";
import { db } from "./db/index.ts";
import { user as userTable } from "./db/schema.ts";
import { isMasterEmail, type Role } from "./roles.ts";

/**
 * Session helpers for Server Components, Server Actions and Route Handlers.
 *
 * Kept separate from lib/auth.ts because this module imports `next/headers`, and
 * the Worker — a plain Node script — must be able to import the auth and schema
 * modules without dragging Next in. See ADR-0002.
 */

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  isMaster: boolean;
};

/**
 * Signs you in as the Master on localhost, with no password.
 *
 * DEVELOPMENT ONLY, and the guard is the first line of the function rather than
 * a condition at the call site, so there is exactly one place to check. On Vercel
 * NODE_ENV is "production" for both `next build` and the running server, so this
 * cannot fire there. The matching skip in middleware.ts must keep the same guard.
 *
 * It resolves a real `user` row rather than inventing an object: recipe.author_id
 * is a foreign key, so a made-up id would fail on the first save and teach you
 * nothing about whether the editor works. If MASTER_EMAIL has no row yet, one is
 * created — with no password and no credential, so it cannot be signed into from
 * the outside. That is deliberate: this account exists for localhost, and the
 * real one is still minted by scripts/bootstrap-master.ts.
 */
async function devMaster(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "development") return null;

  const email = process.env.MASTER_EMAIL?.trim();
  if (!email) return null;

  const [existing] = await db
    .select({ id: userTable.id, name: userTable.name, image: userTable.image })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  let id = existing?.id;
  if (!id) {
    id = randomUUID();
    await db.insert(userTable).values({
      id,
      email,
      name: "Dev",
      emailVerified: true,
      role: "master",
    });
  }

  console.warn(`[dev] auth bypassed, acting as ${email}`);

  return {
    id,
    email,
    name: existing?.name ?? "Dev",
    image: existing?.image ?? null,
    // Still derived from MASTER_EMAIL, exactly as in the real path (OR-12).
    role: isMasterEmail(email) ? "master" : "member",
    isMaster: isMasterEmail(email),
  };
}

/** The signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return devMaster();

  const { user } = session;
  /**
   * Master is decided by MASTER_EMAIL, not by the stored column. A tampered or
   * stale `role` value cannot promote anyone.
   */
  const isMaster = isMasterEmail(user.email);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? null,
    role: isMaster ? "master" : "member",
    isMaster,
  };
}

/** Throws when nobody is signed in. For Server Actions, which must not assume. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorised: no session");
  return user;
}

/**
 * The single Master check. Master-only Server Actions call this; Master-only
 * routes call it and render a 404 rather than a 403, so the route does not
 * advertise its own existence (OR-16).
 */
export async function requireMaster(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isMaster) throw new Error("Forbidden: master only");
  return user;
}
