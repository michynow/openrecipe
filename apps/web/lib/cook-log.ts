import { and, count, eq, gt, max, sql } from "drizzle-orm";

import { db } from "./db/index.ts";
import { cookLog } from "./db/schema.ts";

/**
 * The Cook Log — "I made this" (OR-32).
 *
 * The only behavioural data in the system. Phase 5 reads it for the dashboard's
 * counts and to keep Proposals off anything cooked in the last week; this module
 * writes it and summarises one Recipe, which is all the Recipe page needs.
 *
 * Entries are not filtered by author. The count on the page is the household's,
 * not yours — per-user stats are a separate ticket.
 */

/** How long after logging the undo still works. See the note in lib/recipes.ts. */
const UNDO_GRACE_MS = 60_000;

export type CookLogSummary = {
  /** How many times this Recipe has been cooked, by anyone. */
  times: number;
  /** Null until somebody cooks it for the first time. */
  lastCookedAt: Date | null;
};

export async function getCookLog(recipeId: string): Promise<CookLogSummary> {
  const [row] = await db
    .select({ times: count(), last: max(cookLog.cookedAt) })
    .from(cookLog)
    .where(eq(cookLog.recipeId, recipeId));

  return {
    times: row?.times ?? 0,
    /**
     * An aggregate does not go through the column's own decoder, so `max` can come
     * back as the raw string the driver read. Normalising here means callers only
     * ever deal with a Date.
     */
    lastCookedAt: row?.last ? new Date(row.last) : null,
  };
}

/**
 * Write an entry. Logging the same Recipe twice in one day is allowed on purpose —
 * see the note on the table in lib/db/schema.ts.
 *
 * Returns the new entry's id, which is the only handle the undo has — or null
 * when there is no live Recipe with that id (deleted, or never existed). One
 * statement, so a delete landing in between cannot slip a row past the check.
 */
export async function logCooked(
  recipeId: string,
  userId: string,
): Promise<string | null> {
  const inserted = await db.execute<{ id: string }>(sql`
    insert into cook_log (recipe_id, user_id)
    select id, ${userId} from recipe
    where id = ${recipeId} and deleted_at is null
    returning id
  `);

  return inserted.rows[0]?.id ?? null;
}

/**
 * The undo behind the "Ugotowane!" toast — a real delete, because a Cook Log entry
 * that never happened should not linger as a tombstone skewing the counts.
 *
 * Scoped to its own author and to the grace window, so this stays an undo rather
 * than becoming the general "delete a log entry" endpoint that OR-32 puts out of
 * scope.
 */
export async function undoCooked(
  entryId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(cookLog)
    .where(
      and(
        eq(cookLog.id, entryId),
        eq(cookLog.userId, userId),
        gt(cookLog.cookedAt, new Date(Date.now() - UNDO_GRACE_MS)),
      ),
    )
    .returning({ id: cookLog.id });

  return rows.length > 0;
}
