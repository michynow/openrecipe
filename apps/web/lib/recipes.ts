import { randomUUID } from "node:crypto";

import { and, eq, gt, inArray, isNull } from "drizzle-orm";

import { deleteBlob } from "./blob-server.ts";
import { db } from "./db/index.ts";
import { ingredientLine, recipe, recipeTag, tag } from "./db/schema.ts";
import { copy } from "@openrecipe/core/copy";
import { recipeSchema, type RecipeInput } from "@openrecipe/core/recipe-schema";
import { uniqueSlug } from "@openrecipe/core/slug";

/**
 * Writing Recipes.
 *
 * Every entry point validates with the shared Zod schema first and ignores
 * whatever the caller claims it already checked. These functions are reachable
 * from Server Actions and from the Worker, neither of which is a trusted input.
 */

export type SaveResult =
  | { ok: true; slug: string; id: string }
  /** `reason` is for code to branch on; `errors` are Polish, for people. */
  | { ok: false; errors: string[]; reason?: "not-ready" };

/**
 * Resolve Tag slugs to ids, refusing anything not in the table.
 *
 * Returns a result rather than throwing. These functions are called from Server
 * Actions, and a thrown action reaches the user as an error page instead of a
 * message on the form they were filling in.
 */
async function resolveTagIds(
  slugs: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; errors: string[] }> {
  if (slugs.length === 0) return { ok: true, ids: [] };

  const rows = await db
    .select({ id: tag.id, slug: tag.slug })
    .from(tag)
    .where(inArray(tag.slug, slugs));

  if (rows.length !== slugs.length) {
    const found = new Set(rows.map((r) => r.slug));
    const missing = slugs.filter((s) => !found.has(s));
    return { ok: false, errors: [`${copy.validation.tagUnknown} ${missing.join(", ")}`] };
  }

  return { ok: true, ids: rows.map((r) => r.id) };
}

/**
 * Numeric columns come back from pg as strings, and go in as strings too. Keeping
 * the conversion in one place stops "2" and 2 drifting apart across call sites.
 */
const toNumeric = (value: number | null) =>
  value === null ? null : String(value);

export async function createRecipe(
  input: RecipeInput,
  authorId: string,
): Promise<SaveResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  const tags = await resolveTagIds(data.tagSlugs);
  if (!tags.ok) return { ok: false, errors: tags.errors };
  const tagIds = tags.ids;

  /**
   * The only query here that deliberately does NOT filter `deleted_at`. A
   * soft-deleted Recipe still occupies its slug — the row is there and the unique
   * index is real — so pretending it is gone would collide on insert.
   */
  const slug = await uniqueSlug(data.title, async (candidate) => {
    const hit = await db
      .select({ id: recipe.id })
      .from(recipe)
      .where(eq(recipe.slug, candidate))
      .limit(1);
    return hit.length > 0;
  });

  /**
   * The id is generated here rather than by the database, so that every statement
   * below is known before any of them run — which is what lets them go out as one
   * batch. See the note on atomicity at the bottom of this file.
   */
  const id = randomUUID();

  const statements: unknown[] = [
    db.insert(recipe).values({
      id,
      slug,
      title: data.title,
      imageUrl: data.imageUrl,
      servings: data.servings,
      totalMinutes: data.totalMinutes,
      kcalPerServing: data.kcalPerServing,
      sourceUrl: data.sourceUrl,
      authorId,
      steps: data.steps,
      tips: data.tips,
    }),
    db.insert(ingredientLine).values(
      data.ingredientLines.map((line, index) => ({
        recipeId: id,
        position: index,
        quantity: toNumeric(line.quantity),
        unit: line.unit,
        item: line.item,
        note: line.note,
        substitutes: line.substitutes,
      })),
    ),
  ];

  if (tagIds.length > 0) {
    statements.push(
      db.insert(recipeTag).values(tagIds.map((tagId) => ({ recipeId: id, tagId }))),
    );
  }

  await runAtomically(statements);

  return { ok: true, slug, id };
}

export async function updateRecipe(
  recipeId: string,
  input: RecipeInput,
  editorId: string,
): Promise<SaveResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  // A soft-deleted Recipe is gone as far as the app is concerned, and this action
  // is a public POST endpoint — editing one back into visibility is not an undo.
  const existing = await db
    .select({
      slug: recipe.slug,
      authorId: recipe.authorId,
      imageUrl: recipe.imageUrl,
    })
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), isNull(recipe.deletedAt)))
    .limit(1);

  if (existing.length === 0) return { ok: false, errors: ["Nie ma takiego przepisu."] };

  const tags = await resolveTagIds(data.tagSlugs);
  if (!tags.ok) return { ok: false, errors: tags.errors };
  const tagIds = tags.ids;

  const statements: unknown[] = [
    db
      .update(recipe)
      .set({
        title: data.title,
        imageUrl: data.imageUrl,
        servings: data.servings,
        totalMinutes: data.totalMinutes,
        kcalPerServing: data.kcalPerServing,
        sourceUrl: data.sourceUrl,
        steps: data.steps,
        tips: data.tips,
        // author_id is never touched. It is provenance, not permission — anyone
        // signed in may edit any Recipe (PRD §5), and the original typist keeps
        // the credit. updated_by records who touched it last.
        updatedById: editorId,
        updatedAt: new Date(),
      })
      .where(eq(recipe.id, recipeId)),

    /**
     * Ingredient Lines and Tags are replaced wholesale rather than diffed. The
     * editor always submits the complete list, so a diff would be more code for
     * the same result. Consequence: line ids change on every save, which is fine
     * because Pantry Check ticks live for one day (ADR-0004).
     */
    db.delete(ingredientLine).where(eq(ingredientLine.recipeId, recipeId)),
    db.insert(ingredientLine).values(
      data.ingredientLines.map((line, index) => ({
        recipeId,
        position: index,
        quantity: toNumeric(line.quantity),
        unit: line.unit,
        item: line.item,
        note: line.note,
        substitutes: line.substitutes,
      })),
    ),
    db.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId)),
  ];

  if (tagIds.length > 0) {
    statements.push(
      db.insert(recipeTag).values(tagIds.map((tagId) => ({ recipeId, tagId }))),
    );
  }

  await runAtomically(statements);

  /**
   * The image the Recipe used to carry is now unreachable, so the blob goes with
   * it. Deliberately *after* the write, not when the editor cleared the field:
   * until the save commits, the old URL is still what the Recipe shows, and an
   * abandoned edit must not take the picture with it.
   */
  if (existing[0].imageUrl !== data.imageUrl) {
    await deleteBlob(existing[0].imageUrl);
  }

  // The slug deliberately does not follow the title: old links keep working.
  return { ok: true, slug: existing[0].slug, id: recipeId };
}

/**
 * How long after a delete the undo still works.
 *
 * Deliberately longer than the toast that offers it: the toast is a UI timer, this
 * is the trust boundary. A Server Action is reachable by POST from anywhere, and
 * without a window `restoreRecipe` is an un-delete-anything endpoint. Generous
 * enough that a slow phone on a slow network cannot lose someone their undo.
 */
const UNDO_GRACE_MS = 60_000;

/**
 * Deleting a Recipe (OR-25). Soft: the row stays and `deleted_at` is stamped, so
 * every read path has to filter it out — see the note in lib/recipe-query.ts.
 *
 * Any signed-in user may delete any Recipe (PRD §5); the caller has already
 * checked that somebody is signed in.
 *
 * Returns the slug so the caller can revalidate the page, or null when nothing was
 * deleted. The `isNull` guard is what makes a second delete a no-op instead of
 * moving the timestamp forward, which would quietly extend the undo window.
 */
export async function deleteRecipe(recipeId: string): Promise<string | null> {
  const [row] = await db
    .update(recipe)
    .set({ deletedAt: new Date() })
    .where(and(eq(recipe.id, recipeId), isNull(recipe.deletedAt)))
    .returning({ slug: recipe.slug });

  return row?.slug ?? null;
}

/**
 * The undo behind the delete toast. There is no restore screen — this is the only
 * way back, by design (OR-25).
 *
 * `gt` on a nullable column does the work of two checks: a Recipe that was never
 * deleted has `deleted_at` null, `null > x` is null, and the row simply does not
 * match.
 */
export async function restoreRecipe(recipeId: string): Promise<string | null> {
  const [row] = await db
    .update(recipe)
    .set({ deletedAt: null })
    .where(
      and(
        eq(recipe.id, recipeId),
        gt(recipe.deletedAt, new Date(Date.now() - UNDO_GRACE_MS)),
      ),
    )
    .returning({ slug: recipe.slug });

  return row?.slug ?? null;
}

/**
 * Run a fixed list of writes atomically.
 *
 * `db.transaction()` is NOT available on the Neon HTTP driver — it throws
 * "No transactions support in neon-http driver". HTTP has no session to hold a
 * transaction open across round trips.
 *
 * `db.batch()` is the replacement: Neon wraps the whole batch in a single
 * server-side transaction, so it is all-or-nothing exactly as required. The
 * constraint it imposes is that every statement must be known before the batch
 * runs — no reading a generated id and using it in a later statement. That is why
 * Recipe ids are generated with randomUUID() in application code.
 *
 * If a future write genuinely needs read-then-write inside a transaction, the fix
 * is the WebSocket driver (drizzle-orm/neon-serverless), not abandoning atomicity.
 */
async function runAtomically(statements: unknown[]): Promise<void> {
  // drizzle types batch as a non-empty tuple; the shape is checked at runtime.
  await (db as unknown as { batch: (s: unknown[]) => Promise<unknown> }).batch(
    statements,
  );
}
