import { sql, type SQL } from "drizzle-orm";

import { db } from "./db/index.ts";
import type { RecipeCardData } from "../components/recipe-card.tsx";
import type { SearchParams } from "@openrecipe/core/search-params";
import { byFacet, type ChipTag } from "@openrecipe/core/tags";

/**
 * The one search query (OR-35). Everything /search can ask — text, Facet filters,
 * max time, has-image, next page — is this function with different arguments.
 *
 * Written as raw `sql` rather than through the query builder. It leans on things
 * the builder has no vocabulary for: the trigram operators, GREATEST over a
 * correlated subquery, and a row-wise comparison for the keyset cursor. Composing
 * those as builder fragments would be more code that reads worse.
 *
 * It returns exactly what a card renders. A search page pulling steps, tips and
 * Ingredient Lines for twenty-four tiles is the mistake this shape prevents.
 */

export type SearchPage = {
  recipes: RecipeCardData[];
  /** Null when that was the last page. */
  nextCursor: string | null;
};

/** Fills the 2/3/4-column grid evenly at every breakpoint. */
const DEFAULT_LIMIT = 24;

/**
 * Requests arrive from a URL, so the page size is untrusted input. Without a
 * ceiling `?limit=100000` is a way to ask the database for the whole library.
 */
const MAX_LIMIT = 48;

/**
 * The cursor's contents. `score` rides along only when there is a text query,
 * because that is when it is part of the sort key.
 *
 * Opaque to the caller by intent: it is a position in a result set, not an API.
 */
type Cursor = { score?: number; createdAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * Returns null for anything that is not a cursor we wrote. A truncated or
 * hand-edited cursor should quietly restart the scroll, not throw a 500 at
 * someone who pasted a URL badly.
 *
 * The shapes are checked, not just the types: these two values are interpolated
 * into `::uuid` and `::timestamp` casts, and a string that is neither makes
 * Postgres raise rather than return an empty page.
 */
export function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString());
    if (
      !UUID.test(parsed?.id) ||
      !TIMESTAMP.test(parsed?.createdAt) ||
      (parsed.score !== undefined && !Number.isFinite(parsed.score))
    ) {
      return null;
    }
    return parsed as Cursor;
  } catch {
    return null;
  }
}

/**
 * How well `query` matches one Recipe: the best of its title and any one of its
 * Ingredient Lines.
 *
 * `word_similarity` rather than plain `similarity` because the query is a word or
 * two and the target is a whole title — `similarity('zurek', 'żurek staropolski')`
 * is far below any usable threshold, while the word form scores it 1.0.
 *
 * Both sides go through `immutable_unaccent(lower(...))`, which is both what makes
 * the search diacritic-blind and what lets the GIN indexes from OR-34 serve it.
 */
const score = (query: string): SQL =>
  sql`greatest(
        word_similarity(public.immutable_unaccent(lower(${query})), public.immutable_unaccent(lower(r.title))),
        coalesce((select max(word_similarity(public.immutable_unaccent(lower(${query})), public.immutable_unaccent(lower(il.item))))
                    from ingredient_line il
                   where il.recipe_id = r.id), 0::real)
      )`;

export async function searchRecipes(
  params: SearchParams = {},
): Promise<SearchPage> {
  const query = params.query?.trim() || null;
  const tagSlugs = params.tagSlugs?.filter(Boolean) ?? [];
  // `??` only catches undefined, and a limit parsed out of a URL is as likely to
  // arrive as NaN — which survives both clamps and reaches the query as `limit NaN`.
  const limit = Number.isFinite(params.limit)
    ? Math.min(Math.max(Math.trunc(params.limit!), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const cursor = decodeCursor(params.cursor);

  // Soft delete is a hard rule on every read path (OR-25): a deleted Recipe is
  // gone as far as the app is concerned, and search is the easiest place to leak
  // one back.
  const where: SQL[] = [sql`r.deleted_at is null`];

  if (query) {
    /**
     * Written as a UNION of two index scans rather than `title %> q OR EXISTS
     * (...)`. The OR form makes the planner give up on the recipe index and
     * sequential-scan the table; this form keeps both GIN indexes in play.
     */
    where.push(sql`r.id in (
      select r2.id from recipe r2
       where public.immutable_unaccent(lower(r2.title)) %> public.immutable_unaccent(lower(${query}))
      union
      select il.recipe_id from ingredient_line il
       where public.immutable_unaccent(lower(il.item)) %> public.immutable_unaccent(lower(${query}))
    )`);
  }

  if (tagSlugs.length > 0) {
    /**
     * OR within a Facet, AND across Facets, in one expression: count how many
     * distinct Facets the Recipe is hit on, and demand it be all of them.
     *
     * Picking two Meal Slots leaves the right-hand side at 1, so either satisfies
     * it and the result widens. Adding a Diet makes it 2, and only a Recipe
     * carrying both a chosen Meal Slot and a chosen Diet still qualifies.
     *
     * A slug that is not in the table contributes to neither side, so a stale URL
     * loses that one filter rather than returning nothing.
     */
    // Spelled out as a bound-parameter list rather than `= any($1)`: an array
    // handed to `sql` is treated as chunks to splice, not as one value.
    const slugs = sql.join(
      tagSlugs.map((slug) => sql`${slug}`),
      sql`, `,
    );
    where.push(sql`(
      select count(distinct t.facet)
        from recipe_tag rt join tag t on t.id = rt.tag_id
       where rt.recipe_id = r.id and t.slug in (${slugs})
    ) = (select count(distinct facet) from tag where slug in (${slugs}))`);
  }

  // Nulls drop out on their own, which is the wanted behaviour: a Recipe whose
  // time nobody recorded cannot be promised to be under half an hour.
  if (params.maxTotalMinutes !== undefined) {
    where.push(sql`r.total_minutes <= ${params.maxTotalMinutes}`);
  }

  if (params.hasImage) where.push(sql`r.image_url is not null`);

  /**
   * Keyset, never OFFSET. The row comparison is the whole trick: one `<` over the
   * complete sort key means a Recipe added mid-scroll shifts nothing, because
   * "after the last row I showed" is defined by that row's own values rather than
   * by how many rows happen to sit in front of it.
   *
   * The sort key grows a leading `score` when there is a query, and the cursor
   * carries it, so relevance order pages just as safely as date order.
   */
  if (cursor) {
    where.push(
      query
        ? sql`(${score(query)}, r.created_at, r.id) < (${cursor.score ?? 0}::real, ${cursor.createdAt}::timestamp, ${cursor.id}::uuid)`
        : sql`(r.created_at, r.id) < (${cursor.createdAt}::timestamp, ${cursor.id}::uuid)`,
    );
  }

  const orderBy = query
    ? sql`order by score desc, r.created_at desc, r.id desc`
    : sql`order by r.created_at desc, r.id desc`;

  const rows = await db.execute<{
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    totalMinutes: number | null;
    tags: ChipTag[];
    createdAt: string;
    score: number | null;
  }>(sql`
    select
      r.id,
      r.slug,
      r.title,
      r.image_url as "imageUrl",
      r.total_minutes as "totalMinutes",
      -- ::text, not the Date the driver would otherwise hand back. created_at is
      -- a naive timestamp, so a round trip through Date shifts it by the local
      -- offset and the cursor lands in the wrong place.
      r.created_at::text as "createdAt",
      ${query ? score(query) : sql`null::real`} as score,
      coalesce((select json_agg(json_build_object('slug', t.slug, 'label', t.label, 'facet', t.facet)
                                order by t.label)
                  from recipe_tag rt join tag t on t.id = rt.tag_id
                 where rt.recipe_id = r.id), '[]'::json) as tags
    from recipe r
    where ${sql.join(where, sql` and `)}
    ${orderBy}
    limit ${limit + 1}
  `);

  // One row over the page size is how we know there is a next page without a
  // second count query.
  const page = rows.rows.slice(0, limit);
  const last = page.at(-1);

  return {
    recipes: page.map((row) => ({
      slug: row.slug,
      title: row.title,
      imageUrl: row.imageUrl,
      totalMinutes: row.totalMinutes,
      tags: byFacet(row.tags),
    })),
    nextCursor:
      rows.rows.length > limit && last
        ? encodeCursor({
            ...(query ? { score: last.score ?? 0 } : {}),
            createdAt: last.createdAt,
            id: last.id,
          })
        : null,
  };
}
