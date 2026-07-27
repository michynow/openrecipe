/**
 * Who is the Master.
 *
 * The authority is the `MASTER_EMAIL` environment variable, not the `role` column.
 * That is the whole design: a privilege that is never assignable has no escalation
 * path. No request, Server Action or SQL injection can grant it, because granting
 * is not a thing that exists — you would have to redeploy with a different
 * environment variable.
 *
 * The `role` column is a denormalisation, kept in step at sign-up so that queries
 * and displayed labels agree with reality. It is never the thing that is checked.
 */

export type Role = "master" | "member";

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
