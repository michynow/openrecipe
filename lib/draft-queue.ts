import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "./db/index.ts";
import { draft, recipe } from "./db/schema.ts";
import {
  assertReady,
  assertTransition,
  isDraftStatus,
  parseDraftPayload,
  RECLAIM_AFTER_MS,
  sourceUrlSchema,
  type DraftStatus,
} from "./drafts.ts";
import type { RecipeFormValue } from "./recipe-schema.ts";

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

export type DraftForReview = DraftRow & {
  payload: RecipeFormValue;
  inferred: string[];
};

/**
 * One Draft, for the review screen (OR-44).
 *
 * Returns null unless it is `ready` and its payload still parses. A Draft whose
 * payload no longer validates — the schema tightened since it was generated, say
 * — must not open an editor half-populated with fields the save will reject.
 */
export async function getDraftForReview(
  id: string,
): Promise<DraftForReview | null> {
  const [row] = await db.select().from(draft).where(eq(draft.id, id)).limit(1);

  if (!row || row.status !== "ready") return null;

  const payload = parseDraftPayload(row.payload);
  if (!payload) return null;

  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    status: "ready",
    error: row.error,
    recipeId: row.recipeId,
    createdAt: row.createdAt,
    payload,
    inferred: row.inferred ?? [],
  };
}

/**
 * The Draft became a Recipe. Terminal: `recipe_id` is the link back, and it is
 * what stops the same import being approved twice.
 */
export async function markApproved(id: string, recipeId: string): Promise<void> {
  const [row] = await db
    .select({ status: draft.status })
    .from(draft)
    .where(eq(draft.id, id))
    .limit(1);

  if (!row || !isDraftStatus(row.status)) return;
  assertTransition(row.status, "approved");

  await db
    .update(draft)
    .set({ status: "approved", recipeId, processedAt: new Date() })
    .where(eq(draft.id, id));
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

/* ─────────────────────────── The Worker's side ────────────────────────── */

/**
 * Take back Drafts abandoned mid-run, so a closed laptop does not strand them.
 *
 * The timeout lives in lib/drafts.ts as RECLAIM_AFTER_MS and is interpolated as
 * milliseconds rather than reformatted as an interval string, so there is one
 * number and the tests can reason about it.
 */
export async function reclaimStale(): Promise<number> {
  const result = await db.execute(sql`
    update draft
       set status = 'queued', claimed_at = null
     where status = 'processing'
       and (claimed_at is null
            or claimed_at < now() - (${RECLAIM_AFTER_MS} || ' milliseconds')::interval)
    returning id`);

  return (result.rows ?? []).length;
}

/**
 * Claim exactly one queued Draft, atomically.
 *
 * `for update skip locked` inside the subquery is what makes two Workers safe to
 * run at once: the second one steps over the row the first is taking rather than
 * blocking on it or claiming it twice. The whole thing is one statement because
 * the Neon HTTP driver has no multi-statement transaction (see lib/recipes.ts).
 *
 * Returns null when the queue is empty, which is the Worker's cue to exit.
 */
export async function claimNextDraft(): Promise<DraftRow | null> {
  const result = await db.execute(sql`
    update draft
       set status = 'processing', claimed_at = now()
     where id = (select id
                   from draft
                  where status = 'queued'
                  order by created_at
                  limit 1
                    for update skip locked)
    returning id, source_url, status, error, recipe_id, created_at`);

  const row = (result.rows ?? [])[0] as
    | {
        id: string;
        source_url: string;
        status: string;
        error: string | null;
        recipe_id: string | null;
        created_at: string | Date;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    sourceUrl: row.source_url,
    status: "processing",
    error: row.error,
    recipeId: row.recipe_id,
    createdAt: new Date(row.created_at),
  };
}

/**
 * The Worker got a Recipe out of the page. Validated here rather than trusted:
 * `ready` is what puts a Draft in front of a human, and a payload that does not
 * parse would make the review screen throw instead of the Worker failing.
 */
export async function markReady(
  id: string,
  payload: unknown,
  inferred: string[] = [],
): Promise<void> {
  const recipe = assertReady(payload);

  await db
    .update(draft)
    .set({
      status: "ready",
      payload: recipe,
      inferred,
      error: null,
      processedAt: new Date(),
    })
    .where(eq(draft.id, id));
}

/**
 * Every failure path ends here. The message is Polish and is shown verbatim on
 * the Drafts screen, so it says what happened and what to do — never a stack
 * trace, never an error code.
 */
export async function markFailed(id: string, error: string): Promise<void> {
  await db
    .update(draft)
    .set({ status: "failed", error, processedAt: new Date() })
    .where(eq(draft.id, id));
}

/** "Try that link again" — failed, or a ready Draft nobody liked. */
export async function retryDraft(id: string): Promise<boolean> {
  return transition(id, "queued");
}

/** "Forget it." Terminal; there is no un-discard. */
export async function discardDraft(id: string): Promise<boolean> {
  return transition(id, "discarded");
}
