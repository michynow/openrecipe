import { and, asc, count, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "./db/index.ts";
import { account, draft, recipeTag, session, tag, user } from "./db/schema.ts";
import { effectiveRole, isMasterEmail, type Role } from "./roles.ts";
import type { Facet } from "./db/tags.ts";

/**
 * The Master's screen (OR-50): who is in, what the taxonomy holds, what the
 * queue is doing.
 *
 * Every function here is admin-only at the call site — the Server Actions call
 * `requireAdmin()` — and none of them takes the caller's word for anything else.
 */

/* ───────────────────────────── Members ───────────────────────────────── */

export type Member = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  isMaster: boolean;
  joinedAt: Date;
};

export async function listMembers(): Promise<Member[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      storedRole: user.role,
      joinedAt: user.createdAt,
    })
    .from(user)
    .where(isNull(user.removedAt))
    .orderBy(asc(user.createdAt));

  // Master is decided by MASTER_EMAIL, never by the stored column (OR-12).
  return rows.map(({ storedRole, ...row }) => {
    const role = effectiveRole(row.email, storedRole);
    return { ...row, role, isMaster: role === "master" };
  });
}

/**
 * Grant or take away admin. Only "admin" and "member" are accepted — Master is
 * not grantable — and the Master's own row is refused, so nobody can demote them.
 */
export async function setMemberRole(
  id: string,
  role: string,
): Promise<RemoveResult> {
  if (role !== "admin" && role !== "member") return { ok: false, reason: "missing" };

  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.id, id), isNull(user.removedAt)))
    .limit(1);

  if (!row) return { ok: false, reason: "missing" };
  if (isMasterEmail(row.email)) return { ok: false, reason: "master" };

  await db.update(user).set({ role }).where(eq(user.id, id));

  return { ok: true };
}

export type RemoveResult = { ok: true } | { ok: false; reason: "master" | "missing" };

/**
 * Remove a Member.
 *
 * The `user` row survives on purpose: `recipe.author_id` points at it, and
 * attribution outlives membership — PRD §5 says the original typist keeps the
 * credit. What goes is the ability to get back in: sessions deleted, credentials
 * deleted, and `removed_at` stamped so a Google sign-in cannot relink by email.
 *
 * The Master cannot remove themselves. Checked against MASTER_EMAIL rather than
 * against "is this me", so it holds even if the request is forged.
 */
export async function removeMember(id: string): Promise<RemoveResult> {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.id, id), isNull(user.removedAt)))
    .limit(1);

  if (!row) return { ok: false, reason: "missing" };
  if (isMasterEmail(row.email)) return { ok: false, reason: "master" };

  await db.update(user).set({ removedAt: new Date() }).where(eq(user.id, id));
  await db.delete(session).where(eq(session.userId, id));
  await db.delete(account).where(eq(account.userId, id));

  return { ok: true };
}

/* ─────────────────────────────── Tags ────────────────────────────────── */

export type TagRow = {
  id: string;
  facet: Facet;
  slug: string;
  label: string;
  /** How many Recipes carry it. Deleting a Tag in use is refused. */
  uses: number;
};

export async function listTagsWithUse(): Promise<TagRow[]> {
  const rows = await db
    .select({
      id: tag.id,
      facet: tag.facet,
      slug: tag.slug,
      label: tag.label,
      uses: count(recipeTag.recipeId),
    })
    .from(tag)
    .leftJoin(recipeTag, eq(recipeTag.tagId, tag.id))
    .groupBy(tag.id, tag.facet, tag.slug, tag.label)
    /**
     * Polish collation, explicitly. This database's default is C.UTF-8, which
     * sorts by byte value and dumps every diacritic after Z — Świeże would land
     * after Zdrowe. The `-x-icu` suffix is not optional either: the bare name
     * "pl-PL" does not exist on Neon and errors the query outright (PRD §11).
     */
    .orderBy(sql`${tag.facet}, ${tag.label} collate "pl-PL-x-icu"`);

  return rows as TagRow[];
}

/** English, lowercase, hyphenated. What code and queries reference (ADR-0005). */
const SLUG = /^[a-z][a-z0-9-]{1,39}$/;

export type TagResult =
  | { ok: true }
  | { ok: false; reason: "slug" | "duplicate" | "in-use" | "missing"; uses?: number };

export async function addTag(
  facet: Facet,
  slug: string,
  label: string,
): Promise<TagResult> {
  const cleanSlug = slug.trim().toLowerCase();
  const cleanLabel = label.trim();

  if (!SLUG.test(cleanSlug) || cleanLabel.length === 0) {
    return { ok: false, reason: "slug" };
  }

  const [existing] = await db
    .select({ id: tag.id })
    .from(tag)
    .where(eq(tag.slug, cleanSlug))
    .limit(1);

  if (existing) return { ok: false, reason: "duplicate" };

  await db.insert(tag).values({ facet, slug: cleanSlug, label: cleanLabel });

  return { ok: true };
}

/**
 * Rename the Polish label only. The slug is immutable once created: code,
 * filters, saved URLs and the Worker's prompt all reference it, and a rename
 * would break every one of them silently (ADR-0005).
 */
export async function renameTag(id: string, label: string): Promise<TagResult> {
  const clean = label.trim();
  if (clean.length === 0) return { ok: false, reason: "slug" };

  const rows = await db
    .update(tag)
    .set({ label: clean })
    .where(eq(tag.id, id))
    .returning({ id: tag.id });

  return rows.length > 0 ? { ok: true } : { ok: false, reason: "missing" };
}

/** Refused while any Recipe carries it — with the count, so the answer is actionable. */
export async function deleteTag(id: string): Promise<TagResult> {
  const [used] = await db
    .select({ n: count() })
    .from(recipeTag)
    .where(eq(recipeTag.tagId, id));

  if ((used?.n ?? 0) > 0) return { ok: false, reason: "in-use", uses: used.n };

  const rows = await db
    .delete(tag)
    .where(eq(tag.id, id))
    .returning({ id: tag.id });

  return rows.length > 0 ? { ok: true } : { ok: false, reason: "missing" };
}

/* ─────────────────────────── Queue summary ───────────────────────────── */

export type QueueSummary = { queued: number; ready: number; failed: number };

export async function getQueueSummary(): Promise<QueueSummary> {
  const rows = await db
    .select({ status: draft.status, n: count() })
    .from(draft)
    .where(ne(draft.status, "discarded"))
    .groupBy(draft.status);

  const of = (status: string) =>
    rows.find((row) => row.status === status)?.n ?? 0;

  return {
    // Processing counts as queued here: from the Master's side it is the same
    // "the Worker still owes me something".
    queued: of("queued") + of("processing"),
    ready: of("ready"),
    failed: of("failed"),
  };
}
