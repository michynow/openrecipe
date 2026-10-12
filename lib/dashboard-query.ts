import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "./db/index.ts";
import { cookLog, draft, recipe } from "./db/schema.ts";

/**
 * The dashboard's numbers (OR-47).
 *
 * Six small aggregates rather than one clever query: they are independent, they
 * each fit in a line, and Neon's HTTP driver bills round trips in milliseconds,
 * not in anything a household would notice. A single hand-rolled join returning
 * six columns would be harder to read and no faster in practice.
 *
 * Every count filters `deleted_at` — a soft-deleted Recipe is gone as far as the
 * app is concerned, and a stat that still counts it is how a deleted Recipe
 * reappears on one screen but not another.
 */

export type DashboardStats = {
  total: number;
  addedThisWeek: number;
  cookedThisWeek: number;
  draftsWaiting: number;
  mostCooked: { slug: string; title: string; times: number } | null;
  neglected: { slug: string; title: string; days: number | null } | null;
};

/** Statuses that mean a Draft still wants something from a human or the Worker. */
const OPEN_DRAFTS = ["queued", "processing", "limited", "ready", "failed"];

const weekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export async function getDashboardStats(): Promise<DashboardStats> {
  const since = weekAgo();

  const [
    [total],
    [added],
    [cooked],
    [drafts],
    mostCooked,
    neglected,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(recipe)
      .where(isNull(recipe.deletedAt)),

    db
      .select({ n: count() })
      .from(recipe)
      .where(and(isNull(recipe.deletedAt), gte(recipe.createdAt, since))),

    db
      .select({ n: count() })
      .from(cookLog)
      .where(gte(cookLog.cookedAt, since)),

    db
      .select({ n: count() })
      .from(draft)
      .where(sql`${draft.status} in ${OPEN_DRAFTS}`),

    db
      .select({
        slug: recipe.slug,
        title: recipe.title,
        times: count(cookLog.id),
      })
      .from(recipe)
      .innerJoin(cookLog, eq(cookLog.recipeId, recipe.id))
      .where(isNull(recipe.deletedAt))
      .groupBy(recipe.id, recipe.slug, recipe.title)
      .orderBy(desc(count(cookLog.id)))
      .limit(1),

    /**
     * Longest neglected: the Recipe whose last cook is furthest back, and one
     * never cooked at all beats any of them — `max(cooked_at)` is null there, and
     * `nulls first` is what puts it top rather than bottom.
     */
    db
      .select({
        slug: recipe.slug,
        title: recipe.title,
        lastCooked: sql<string | null>`max(${cookLog.cookedAt})`,
      })
      .from(recipe)
      .leftJoin(cookLog, eq(cookLog.recipeId, recipe.id))
      .where(isNull(recipe.deletedAt))
      .groupBy(recipe.id, recipe.slug, recipe.title)
      .orderBy(sql`max(${cookLog.cookedAt}) asc nulls first`)
      .limit(1),
  ]);

  const oldest = neglected[0];

  return {
    total: total?.n ?? 0,
    addedThisWeek: added?.n ?? 0,
    cookedThisWeek: cooked?.n ?? 0,
    draftsWaiting: drafts?.n ?? 0,
    mostCooked: mostCooked[0] ?? null,
    neglected: oldest
      ? {
          slug: oldest.slug,
          title: oldest.title,
          days: oldest.lastCooked ? daysSince(new Date(oldest.lastCooked)) : null,
        }
      : null,
  };
}

/** Whole days, floored: "cooked 6 days ago" should not round up to a week. */
export function daysSince(value: Date, now: Date = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - value.getTime()) / (24 * 60 * 60 * 1000)),
  );
}
