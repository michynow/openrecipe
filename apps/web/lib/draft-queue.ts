import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

import { copy } from "@openrecipe/core/copy";
import { db } from "./db/index.ts";
import { draft, recipe } from "./db/schema.ts";
import {
  assertReady,
  canTransition,
  isDraftStage,
  isDraftStatus,
  parseDraftPayload,
  QUEUE_MAX_MS,
  RECLAIM_AFTER_MS,
  sourceUrlSchema,
  type DraftLogEntry,
  type DraftPulse,
  type DraftStage,
  type DraftStatus,
} from "@openrecipe/core/drafts";
import { getRecipeById, toFormValue } from "./recipe-query.ts";
import { createRecipe, updateRecipe, type SaveResult } from "./recipes.ts";
import type { RecipeFormValue, RecipeInput } from "@openrecipe/core/recipe-schema";

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
  /** Where the Worker is, while `processing`. Null otherwise. */
  stage: DraftStage | null;
  error: string | null;
  recipeId: string | null;
  createdAt: Date;
  /** When it last entered the queue — the "waiting" clock. While limited: when it is retried. */
  queuedAt: Date;
  /** When the Worker picked it up — the "working" clock. */
  claimedAt: Date | null;
  /** What happened, oldest first. */
  log: DraftLogEntry[];
};

/** One log entry as a jsonb array, ready to be concatenated onto `draft.log`. */
const logLine = (level: DraftLogEntry["level"], msg: string) =>
  sql`jsonb_build_array(jsonb_build_object('at', now(), 'level', ${level}::text, 'msg', ${msg}::text))`;

/** Add a line to a Draft's log. Never throws past the caller: a log is not worth a failed import. */
export async function appendLog(
  id: string,
  level: DraftLogEntry["level"],
  msg: string,
): Promise<void> {
  try {
    await db.execute(sql`update draft set log = log || ${logLine(level, msg)} where id = ${id}`);
  } catch (error) {
    console.error("  could not write the draft log:", (error as Error).message);
  }
}

/** Statuses that mean "this link is still going somewhere". */
const OPEN: DraftStatus[] = ["queued", "processing", "limited", "ready"];

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
    .values({
      sourceUrl: parsed.data,
      status: "queued",
      createdBy: userId,
      log: [{ at: new Date().toISOString(), level: "info", msg: copy.imports.log.parked }],
    })
    .returning({ id: draft.id });

  return { ok: true, id: row.id, alreadyQueued: false };
}

export type DraftForReview = DraftRow & {
  payload: RecipeFormValue;
  inferred: string[];
  /** Set on a re-import: the Recipe this Draft is proposing changes to (OR-46). */
  current: RecipeFormValue | null;
  currentSlug: string | null;
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

  /**
   * A re-import carries recipe_id from the moment it is queued, so review can
   * diff against what the Recipe says today rather than showing a blank slate
   * and quietly overwriting six months of corrections.
   */
  const existing = row.recipeId ? await getRecipeById(row.recipeId) : null;

  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    status: "ready",
    stage: null,
    error: row.error,
    recipeId: row.recipeId,
    createdAt: row.createdAt,
    queuedAt: row.queuedAt,
    claimedAt: row.claimedAt,
    log: row.log,
    payload,
    inferred: row.inferred ?? [],
    current: existing ? toFormValue(existing) : null,
    currentSlug: existing?.slug ?? null,
  };
}

/**
 * Queue a re-import of a Recipe that already carries a Source URL (OR-46).
 *
 * Returns null when the Recipe has no Source URL — there is nothing to re-import
 * from — or when one is already in flight, in which case the existing Draft is
 * the answer.
 */
export async function parkReimport(
  recipeId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ sourceUrl: recipe.sourceUrl })
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), isNull(recipe.deletedAt)))
    .limit(1);

  if (!row?.sourceUrl) return null;

  const [inFlight] = await db
    .select({ id: draft.id })
    .from(draft)
    .where(and(eq(draft.recipeId, recipeId), inArray(draft.status, OPEN)))
    .limit(1);

  if (inFlight) return inFlight.id;

  const [created] = await db
    .insert(draft)
    .values({
      sourceUrl: row.sourceUrl,
      status: "queued",
      createdBy: userId,
      recipeId,
      log: [{ at: new Date().toISOString(), level: "info", msg: copy.imports.log.reimport }],
    })
    .returning({ id: draft.id });

  return created.id;
}

/**
 * Approve a reviewed Draft into a Recipe (OR-44, OR-46). The one path for both
 * the Server Action and /api/v1.
 *
 * Claims the Draft first, with a conditional `ready -> approved` update: of two
 * concurrent approvals (a double-tap, two admins) exactly one gets the row back,
 * so only one Recipe is ever created. Neon's HTTP driver has no transactions
 * (see lib/recipes.ts), so the claim is released again if the save refuses or
 * throws — the reviewer's edits are in the request, nothing is lost.
 *
 * `recipeId` set on a re-import: update that Recipe in place.
 */
export async function approveDraft(
  id: string,
  input: RecipeInput,
  userId: string,
  recipeId?: string,
): Promise<SaveResult> {
  // canTransition("ready", "approved"), expressed as the WHERE so it is atomic.
  const [claimed] = await db
    .update(draft)
    .set({ status: "approved", processedAt: new Date() })
    .where(and(eq(draft.id, id), eq(draft.status, "ready")))
    .returning({ id: draft.id });

  if (!claimed) return { ok: false, errors: [copy.imports.notReady], reason: "not-ready" };

  // Not a transition in the model: an undo of our own claim, guarded so it can
  // only ever undo a claim that never got its Recipe.
  const release = () =>
    db
      .update(draft)
      .set({ status: "ready", processedAt: null })
      .where(and(eq(draft.id, id), eq(draft.status, "approved")));

  let result: SaveResult;
  try {
    result = recipeId
      ? await updateRecipe(recipeId, input, userId)
      : await createRecipe(input, userId);
  } catch (error) {
    await release();
    throw error;
  }

  if (!result.ok) {
    await release();
    return result;
  }

  await db.update(draft).set({ recipeId: result.id }).where(eq(draft.id, id));
  return result;
}

/**
 * The Drafts screen's list. Everything, newest first — a household imports a
 * handful of links a week, so paging this would be machinery for nobody.
 */
export async function listDrafts(): Promise<DraftRow[]> {
  await expireStaleQueued();

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
      stage: draft.stage,
      error: draft.error,
      recipeId: draft.recipeId,
      createdAt: draft.createdAt,
      queuedAt: draft.queuedAt,
      claimedAt: draft.claimedAt,
      log: draft.log,
    })
    .from(draft)
    // Finished Drafts are noise here: an approved one lives on as its Recipe,
    // a discarded one was thrown away on purpose.
    .where(notInArray(draft.status, ["approved", "discarded"]))
    .orderBy(desc(draft.createdAt))
    .limit(100);

  return rows
    .map((row) => ({
      ...row,
      // The column is plain text; anything unrecognised is treated as failed
      // rather than crashing a screen whose job is to explain failures.
      status: isDraftStatus(row.status) ? row.status : ("failed" as DraftStatus),
      stage: isDraftStage(row.stage) ? row.stage : null,
    }))
    .sort((a, b) => ATTENTION[a.status] - ATTENTION[b.status]);
}

/**
 * The open Drafts, as little as the header's toast poller needs: status and,
 * once the Worker has written one, the title. Runs every few seconds from every
 * admin tab, so no log, no payload beyond the one field.
 */
export async function listDraftPulse(): Promise<DraftPulse[]> {
  const rows = await db
    .select({
      id: draft.id,
      status: draft.status,
      title: sql<string | null>`${draft.payload}->>'title'`,
    })
    .from(draft)
    .where(notInArray(draft.status, ["approved", "discarded"]))
    .orderBy(desc(draft.createdAt))
    .limit(100);

  return rows.map((row) => ({
    ...row,
    status: isDraftStatus(row.status) ? row.status : ("failed" as DraftStatus),
  }));
}

/** Lower sorts first. Ties keep the newest-first order the query returned. */
const ATTENTION: Record<DraftStatus, number> = {
  ready: 0,
  failed: 1,
  queued: 2,
  processing: 2,
  limited: 2,
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

  // An illegal move is a refusal, not an error: the buttons only offer legal
  // ones, so this is a forged or stale request. Real failures still throw.
  if (!row || !isDraftStatus(row.status) || !canTransition(row.status, to)) return false;

  const moved = await db
    .update(draft)
    .set({
      status: to,
      // Back in the queue means the last attempt is history: its error would
      // otherwise sit on the row looking like a fresh failure, and its claim
      // would make the row look like someone else's work in progress.
      ...(to === "queued"
        ? {
            error: null,
            stage: null,
            claimedAt: null,
            processedAt: null,
            queuedAt: new Date(),
            log: sql`${draft.log} || ${logLine("info", copy.imports.log.requeued)}`,
          }
        : {}),
      ...(to === "discarded" ? { processedAt: new Date() } : {}),
    })
    // Still in the status we checked, or someone else moved it first.
    .where(and(eq(draft.id, id), eq(draft.status, row.status)))
    .returning({ id: draft.id });

  return moved.length > 0;
}

/**
 * Fail every Draft that has waited in the queue longer than QUEUE_MAX_MS.
 *
 * Run lazily — when the Drafts screen loads and when a Worker starts — because
 * there is no scheduler: the app is serverless and the Worker is a laptop. One
 * statement, so two callers at once cannot double-fail a row.
 */
export async function expireStaleQueued(): Promise<number> {
  const result = await db.execute(sql`
    update draft
       set status = 'failed', error = ${copy.imports.failures.expired}, processed_at = now(),
           log = log || ${logLine("error", copy.imports.log.expired)}
     where status = 'queued'
       and queued_at < now() - (${QUEUE_MAX_MS} || ' milliseconds')::interval
    returning id`);

  return (result.rows ?? []).length;
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
       set status = 'queued', claimed_at = null, stage = null, queued_at = now(),
           log = log || ${logLine("warn", copy.imports.log.reclaimed)}
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
 * A `limited` Draft whose retry time has come is claimed like a queued one, so
 * the cron that runs after a usage limit resets picks it up with nobody
 * pressing anything.
 *
 * Returns null when the queue is empty, which is the Worker's cue to exit.
 */
export async function claimNextDraft(): Promise<DraftRow | null> {
  const result = await db.execute(sql`
    update draft
       set status = 'processing', claimed_at = now(), stage = 'fetching'
     where id = (select id
                   from draft
                  where status = 'queued'
                     or (status = 'limited' and queued_at <= now())
                  order by created_at
                  limit 1
                    for update skip locked)
    returning id, source_url, status, error, recipe_id, created_at, queued_at, claimed_at`);

  const row = (result.rows ?? [])[0] as
    | {
        id: string;
        source_url: string;
        status: string;
        error: string | null;
        recipe_id: string | null;
        created_at: string | Date;
        queued_at: string | Date;
        claimed_at: string | Date;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    sourceUrl: row.source_url,
    status: "processing",
    stage: "fetching",
    error: row.error,
    recipeId: row.recipe_id,
    createdAt: new Date(row.created_at),
    queuedAt: new Date(row.queued_at),
    claimedAt: new Date(row.claimed_at),
    log: [],
  };
}

/** The Worker moved on to the next step. Feeds the Drafts screen's progress bar. */
export async function setStage(id: string, stage: DraftStage): Promise<void> {
  await db.update(draft).set({ stage }).where(eq(draft.id, id));
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
      stage: null,
      processedAt: new Date(),
      log: sql`${draft.log} || ${logLine("info", copy.imports.log.ready)}`,
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
    .set({
      status: "failed",
      error,
      stage: null,
      processedAt: new Date(),
      log: sql`${draft.log} || ${logLine("error", error)}`,
    })
    .where(eq(draft.id, id));
}

/**
 * The model's usage limit ran out. The Draft goes back on the shelf until
 * `retryAt` (stored in `queued_at`, see the schema) and the Worker claims it
 * again by itself; nothing about the page was wrong, so there is no error.
 */
export async function markLimited(id: string, retryAt: Date, msg: string): Promise<void> {
  await db
    .update(draft)
    .set({
      status: "limited",
      error: null,
      stage: null,
      claimedAt: null,
      queuedAt: retryAt,
      log: sql`${draft.log} || ${logLine("warn", msg)}`,
    })
    .where(eq(draft.id, id));
}

/** "Try that link again" — failed, limited, or a ready Draft nobody liked. */
export async function retryDraft(id: string): Promise<boolean> {
  return transition(id, "queued");
}

/** "Forget it." Terminal; there is no un-discard. */
export async function discardDraft(id: string): Promise<boolean> {
  return transition(id, "discarded");
}
