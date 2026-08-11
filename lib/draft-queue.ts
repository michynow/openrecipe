import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "./db/index.ts";
import { draft, recipe } from "./db/schema.ts";
import {
  assertTransition,
  isDraftStatus,
  sourceUrlSchema,
  type DraftStatus,
} from "./drafts.ts";

/**
 * Reading and writing the import queue (OR-39, OR-45).
 *
 * Separate from lib/drafts.ts so the status model stays a pure module the tests
 * can import without a database. This file is where that model meets Postgres.
 *
 * The app only ever writes `queued` here. Everything that moves a Draft onward
 * belongs to the Worker (OR-40) — that split is the whole point of ADR-0002.
 */

export type DraftRow = {
  id: string;
  sourceUrl: string;
  status: DraftStatus;
  error: string | null;
  recipeId: string | null;
  createdAt: Date;
};

/** Statuses that mean "this link is still going somewhere". */
const OPEN: DraftStatus[] = ["queued", "processing", "ready"];

export type ParkResult =
  | { ok: true; id: string; alreadyQueued: boolean }
  /** The link is already in the library — offer that Recipe instead of a Draft. */
  | { ok: true; id: null; alreadyQueued: false; existingSlug: string }
  | { ok: false; error: string };

/**
 * Park a Source URL for the Worker to pick up.
 *
 * Parking the same link twice returns the Draft that is already in flight rather
 * than queueing a second one. Not a uniqueness constraint on the column: once a
 * Draft has been approved or discarded, re-importing the same page is a
 * legitimate thing to want, so the rule is about open Drafts only.
 */
export async function parkUrl(
  sourceUrl: string,
  userId: string,
): Promise<ParkResult> {
  const parsed = sourceUrlSchema.safeParse(sourceUrl);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  /**
   * Already imported once? Then the useful answer is the Recipe, not a second
   * trip through the Worker. Checked before the queue because it is the more
   * surprising case: the reader has forgotten they already have this.
   */
  const [imported] = await db
    .select({ slug: recipe.slug })
    .from(recipe)
    .where(and(eq(recipe.sourceUrl, parsed.data), isNull(recipe.deletedAt)))
    .limit(1);

  if (imported) {
    return { ok: true, id: null, alreadyQueued: false, existingSlug: imported.slug };
  }

  const [existing] = await db
    .select({ id: draft.id })
    .from(draft)
    .where(and(eq(draft.sourceUrl, parsed.data), inArray(draft.status, OPEN)))
    .limit(1);

  if (existing) return { ok: true, id: existing.id, alreadyQueued: true };

  const [row] = await db
    .insert(draft)
    .values({ sourceUrl: parsed.data, status: "queued", createdBy: userId })
    .returning({ id: draft.id });

  return { ok: true, id: row.id, alreadyQueued: false };
}

/**
 * The Drafts screen's list. Everything, newest first — a household imports a
 * handful of links a week, so paging this would be machinery for nobody.
 */
export async function listDrafts(): Promise<DraftRow[]> {
  /**
   * Sorted by what wants attention rather than by time alone: ready first, then
   * failures, then whatever is still the Worker's problem, with the finished
   * ones last — "reachable but out of the way" (PRD §7.7).
   */
  const rows = await db
    .select({
      id: draft.id,
      sourceUrl: draft.sourceUrl,
      status: draft.status,
      error: draft.error,
      recipeId: draft.recipeId,
      createdAt: draft.createdAt,
    })
    .from(draft)
    .orderBy(desc(draft.createdAt))
    .limit(100);

  return rows
    .map((row) => ({
      ...row,
      // The column is plain text; anything unrecognised is treated as failed
      // rather than crashing a screen whose job is to explain failures.
      status: isDraftStatus(row.status) ? row.status : ("failed" as DraftStatus),
    }))
    .sort((a, b) => ATTENTION[a.status] - ATTENTION[b.status]);
}

/** Lower sorts first. Ties keep the newest-first order the query returned. */
const ATTENTION: Record<DraftStatus, number> = {
  ready: 0,
  failed: 1,
  queued: 2,
  processing: 2,
  approved: 3,
  discarded: 3,
};

/**
 * Move a Draft to another status, refusing illegal jumps.
 *
 * Reads the current status first and checks the move in application code: the
 * transition table cannot be expressed as a column constraint, and a Server
 * Action is a public endpoint that will be handed whatever id someone likes.
 */
async function transition(id: string, to: DraftStatus): Promise<boolean> {
  const [row] = await db
    .select({ status: draft.status })
    .from(draft)
    .where(eq(draft.id, id))
    .limit(1);

  if (!row || !isDraftStatus(row.status)) return false;
  assertTransition(row.status, to);

  await db
    .update(draft)
    .set({
      status: to,
      // Back in the queue means the last attempt is history: its error would
      // otherwise sit on the row looking like a fresh failure, and its claim
      // would make the row look like someone else's work in progress.
      ...(to === "queued"
        ? { error: null, claimedAt: null, processedAt: null }
        : {}),
      ...(to === "discarded" ? { processedAt: new Date() } : {}),
    })
    .where(eq(draft.id, id));

  return true;
}

/** "Try that link again" — failed, or a ready Draft nobody liked. */
export async function retryDraft(id: string): Promise<boolean> {
  return transition(id, "queued");
}

/** "Forget it." Terminal; there is no un-discard. */
export async function discardDraft(id: string): Promise<boolean> {
  return transition(id, "discarded");
}
