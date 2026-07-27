import { headers } from "next/headers";

import { auth } from "./auth.ts";
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

/** The signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

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
