import { desc, sql } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/confirm-button";
import { CopyInviteLink } from "@/components/copy-invite-link";
import {
  getQueueSummary,
  listMembers,
  listTagsWithUse,
} from "@/lib/admin-query";
import { db } from "@/lib/db";
import { invite } from "@/lib/db/schema";
import { copy } from "@openrecipe/core/copy";
import { count, formatDate, formatRelativeDays } from "@openrecipe/core/format";
import { getCurrentUser } from "@/lib/session";
import { FACETS } from "@openrecipe/core/tags";
import {
  addTagAction,
  deleteTagAction,
  mintInviteAction,
  removeMemberAction,
  renameTagAction,
  revokeInviteAction,
  setMemberRoleAction,
} from "./actions";

/**
 * The admins' screen (OR-49, OR-50): Invites, Members and their roles, the Tag
 * taxonomy and what the import queue is doing.
 *
 * 404 rather than 403 for a Member: a 403 confirms the route exists.
 */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

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

  const [members, tags, queue] = await Promise.all([
    listMembers(),
    listTagsWithUse(),
    getQueueSummary(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
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
                <span className="font-mono text-sm text-muted">
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
                        className="text-sm text-accent2 underline"
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

      {/* ─────────────────────────── Members ─────────────────────────── */}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.settings.members}
        </h2>
        <p className="text-sm text-muted">{copy.settings.rolesHint}</p>

        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 text-sm"
            >
              {member.image && (
                <Image
                  src={member.image}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-full object-cover"
                />
              )}

              <span>{member.name}</span>
              {member.isMaster && (
                <span className="rounded-input border border-accent px-1.5 py-0.5 text-sm text-accent">
                  {copy.settings.master}
                </span>
              )}

              <span className="text-sm text-muted">
                {copy.settings.joined} {formatDate(member.joinedAt)}
              </span>

              {/* The Master cannot be demoted or removed — enforced server-side too. */}
              {!member.isMaster && (
                <form
                  action={setMemberRoleAction}
                  className="ml-auto flex items-center gap-2"
                >
                  <input type="hidden" name="id" value={member.id} />
                  <select
                    name="role"
                    defaultValue={member.role}
                    aria-label={`${copy.settings.role}: ${member.name}`}
                    className="min-h-11 rounded-input border border-line bg-bg px-2 text-sm"
                  >
                    <option value="member">{copy.account.roles.member}</option>
                    <option value="admin">{copy.account.roles.admin}</option>
                  </select>
                  <button
                    type="submit"
                    className="min-h-11 px-2 text-sm text-muted underline transition-colors hover:text-accent"
                  >
                    {copy.settings.saveRole}
                  </button>
                </form>
              )}

              {!member.isMaster && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="id" value={member.id} />
                  <ConfirmButton
                    message={copy.settings.removeMemberConfirm}
                    className="text-sm text-accent2 underline"
                  >
                    {copy.settings.remove}
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}

          {members.length <= 1 && (
            <li className="text-sm text-muted">{copy.settings.membersEmpty}</li>
          )}
        </ul>
      </section>

      {/* ──────────────────────────── Tags ───────────────────────────── */}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.settings.tags}
        </h2>
        <p className="text-sm text-muted">{copy.settings.tagSlugFixed}</p>

        <form
          action={addTagAction}
          className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3"
        >
          <select
            name="facet"
            aria-label={copy.editor.tags}
            className="min-h-11 rounded-input border border-line bg-bg px-2 text-sm"
          >
            {FACETS.map((facet) => (
              <option key={facet} value={facet}>
                {copy.editor.facets[facet]}
              </option>
            ))}
          </select>

          <input
            name="slug"
            required
            pattern="[a-z][a-z0-9-]{1,39}"
            placeholder={copy.settings.tagSlug}
            aria-label={copy.settings.tagSlug}
            className="min-h-11 min-w-32 flex-1 rounded-input border border-line bg-bg px-3 font-mono text-sm"
          />
          <input
            name="label"
            required
            placeholder={copy.settings.tagLabel}
            aria-label={copy.settings.tagLabel}
            className="min-h-11 min-w-32 flex-1 rounded-input border border-line bg-bg px-3 text-sm"
          />

          <button
            type="submit"
            className="min-h-11 rounded-input bg-accent px-4 text-sm font-medium text-accent-ink"
          >
            {copy.settings.addTag}
          </button>
        </form>

        {FACETS.map((facet) => {
          const group = tags.filter((row) => row.facet === facet);
          if (group.length === 0) return null;

          return (
            <div key={facet} className="flex flex-col gap-1.5">
              <p className="text-sm font-extrabold uppercase tracking-wide text-text">
                {copy.editor.facets[facet]}
              </p>

              <ul className="flex flex-col gap-1">
                {group.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-2 rounded-input border border-line px-2 py-1.5 text-sm"
                  >
                    <form
                      action={renameTagAction}
                      className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-56"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        name="label"
                        defaultValue={row.label}
                        aria-label={`${copy.settings.tagLabel}: ${row.slug}`}
                        className="min-h-11 min-w-24 flex-1 rounded-input border border-transparent bg-transparent px-2 hover:border-line focus:border-line"
                      />
                      <button
                        type="submit"
                        className="min-h-11 shrink-0 px-2 text-sm text-muted underline transition-colors hover:text-accent"
                      >
                        {copy.settings.rename}
                      </button>
                    </form>

                    <span className="shrink-0 font-mono text-sm text-muted">
                      {row.slug}
                    </span>

                    <form action={deleteTagAction} className="ml-auto shrink-0">
                      <input type="hidden" name="id" value={row.id} />
                      <ConfirmButton
                        message={`${copy.common.delete}: ${row.label}?`}
                        disabled={row.uses > 0}
                        title={
                          row.uses > 0
                            ? `${copy.settings.tagInUse} ${count(row.uses, copy.units.recipes)}`
                            : undefined
                        }
                        className="min-h-11 px-2 text-sm text-accent2 underline disabled:text-muted disabled:no-underline disabled:opacity-50"
                      >
                        {row.uses > 0
                          ? count(row.uses, copy.units.recipes)
                          : copy.common.delete}
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ──────────────────────── Import queue ───────────────────────── */}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.settings.queue}
        </h2>

        <Link
          href="/drafts"
          className="flex flex-wrap gap-4 rounded-card border border-line bg-surface p-3 text-sm transition-colors hover:border-muted"
        >
          <span>
            <span className="font-mono text-lg">{queue.queued}</span>{" "}
            <span className="text-muted">{copy.settings.queueQueued}</span>
          </span>
          <span>
            <span className="font-mono text-lg text-accent">{queue.ready}</span>{" "}
            <span className="text-muted">{copy.settings.queueReady}</span>
          </span>
          <span>
            <span className="font-mono text-lg text-accent2">{queue.failed}</span>{" "}
            <span className="text-muted">{copy.settings.queueFailed}</span>
          </span>
        </Link>
      </section>
    </main>
  );
}
