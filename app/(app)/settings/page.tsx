import { desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { CopyInviteLink } from "@/components/copy-invite-link";
import { db } from "@/lib/db";
import { invite } from "@/lib/db/schema";
import { copy } from "@/lib/copy";
import { formatRelativeDays } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { mintInviteAction, revokeInviteAction } from "./actions";

/**
 * Minimal settings. OR-49 and OR-50 build the real thing — this exists so the
 * Master can actually mint an Invite without a SQL console.
 *
 * 404 rather than 403 for a Member: a 403 confirms the route exists.
 */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user?.isMaster) notFound();

  /**
   * Expiry is decided by Postgres, not by comparing against `Date.now()` here.
   * Two reasons: calling an impure function during render is a React rule
   * violation, and more importantly `claimInvite` enforces expiry with the
   * database's `now()` — using the same clock means the list can never disagree
   * with what the claim will actually accept.
   */
  const invites = await db
    .select({
      id: invite.id,
      token: invite.token,
      email: invite.email,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
      revokedAt: invite.revokedAt,
      expired: sql<boolean>`${invite.expiresAt} <= now()`,
    })
    .from(invite)
    .orderBy(desc(invite.createdAt))
    .limit(20);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-tight">
        {copy.settings.title}
      </h1>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.settings.invites}
        </h2>
        <p className="text-sm text-muted">{copy.settings.inviteHint}</p>

        <form action={mintInviteAction} className="flex flex-wrap gap-2">
          <input
            name="email"
            type="email"
            placeholder={copy.auth.email}
            aria-label={copy.auth.email}
            className="min-w-0 flex-1 rounded-input border border-line bg-surface px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-input bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            {copy.settings.mintInvite}
          </button>
        </form>

        <ul className="flex flex-col gap-2">
          {invites.map((row) => {
            const state = row.revokedAt
              ? "revoked"
              : row.usedAt
                ? "used"
                : row.expired
                  ? "expired"
                  : "open";

            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted">
                  {row.token.slice(0, 10)}…
                </span>
                {row.email && <span className="text-muted">{row.email}</span>}
                <span
                  className={
                    state === "open" ? "text-accent" : "text-muted"
                  }
                >
                  {state === "open"
                    ? formatRelativeDays(row.expiresAt)
                    : copy.settings.inviteState[state]}
                </span>

                {state === "open" && (
                  <span className="ml-auto flex items-center gap-2">
                    <CopyInviteLink token={row.token} />
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="text-xs text-accent2 underline"
                      >
                        {copy.settings.revoke}
                      </button>
                    </form>
                  </span>
                )}
              </li>
            );
          })}
          {invites.length === 0 && (
            <li className="text-sm text-muted">—</li>
          )}
        </ul>
      </section>
    </main>
  );
}
