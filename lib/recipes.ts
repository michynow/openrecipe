import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { db } from "./db/index.ts";
import { ingredientLine, recipe, recipeTag, tag } from "./db/schema.ts";
import { recipeSchema, type RecipeInput } from "./recipe-schema.ts";
import { uniqueSlug } from "./slug.ts";

/**
 * Writing Recipes.
 *
 * Every entry point validates with the shared Zod schema first and ignores
 * whatever the caller claims it already checked. These functions are reachable
 * from Server Actions and from the Worker, neither of which is a trusted input.
 */

export type SaveResult =
  | { ok: true; slug: string; id: string }
  | { ok: false; errors: string[] };

/** Resolve Tag slugs to ids, and refuse anything not in the table. */
async function resolveTagIds(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];

  const rows = await db
    .select({ id: tag.id, slug: tag.slug })
    .from(tag)
    .where(inArray(tag.slug, slugs));

  if (rows.length !== slugs.length) {
    const found = new Set(rows.map((r) => r.slug));
    const missing = slugs.filter((s) => !found.has(s));
    throw new Error(`Unknown tag slugs: ${missing.join(", ")}`);
  }

  return rows.map((r) => r.id);
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

  const tagIds = await resolveTagIds(data.tagSlugs);

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

  const existing = await db
    .select({ slug: recipe.slug, authorId: recipe.authorId })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .limit(1);

  if (existing.length === 0) return { ok: false, errors: ["Nie ma takiego przepisu."] };

  const tagIds = await resolveTagIds(data.tagSlugs);

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

  // The slug deliberately does not follow the title: old links keep working.
  return { ok: true, slug: existing[0].slug, id: recipeId };
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
