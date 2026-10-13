/**
 * Who is the Master.
 *
 * The authority is the `MASTER_EMAIL` environment variable, not the `role` column.
 * That is the whole design: a privilege that is never assignable has no escalation
 * path. No request, Server Action or SQL injection can grant it, because granting
 * is not a thing that exists — you would have to redeploy with a different
 * environment variable.
 *
 * The `role` column is checked for one thing only: "admin", which admins grant
 * each other from Settings. It can never make anyone Master — see effectiveRole.
 */

/**
 * - master: MASTER_EMAIL. Implicitly an admin, and the only role nobody can grant
 *   or take away.
 * - admin: granted by an admin from Settings. Can do everything the Master can.
 * - member: read-only — browses and cooks from Recipes, changes nothing shared.
 */
export type Role = "master" | "admin" | "member";

/** Emails compare case-insensitively and ignore surrounding whitespace. */
function normalise(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * True when this email is the Master's.
 *
 * An unset or blank `MASTER_EMAIL` makes nobody Master, rather than everybody —
 * failing closed matters more here than being convenient in a misconfigured
 * environment.
 */
export function isMasterEmail(
  email: string | null | undefined,
  masterEmail: string | null | undefined = process.env.MASTER_EMAIL,
): boolean {
  const master = normalise(masterEmail);
  if (master === "") return false;
  return normalise(email) === master;
}

export function roleFor(
  email: string | null | undefined,
  masterEmail?: string | null,
): Role {
  return isMasterEmail(email, masterEmail) ? "master" : "member";
}

/**
 * The role that actually applies. Master still comes from MASTER_EMAIL only; the
 * stored column can grant "admin" and nothing more, so a stale or tampered
 * "master" in the column is just a member.
 */
export function effectiveRole(
  email: string | null | undefined,
  storedRole: string | null | undefined,
  masterEmail?: string | null,
): Role {
  if (isMasterEmail(email, masterEmail)) return "master";
  return storedRole === "admin" ? "admin" : "member";
}
