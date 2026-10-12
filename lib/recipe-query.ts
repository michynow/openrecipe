import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "./db/index.ts";
import type { RecipeFormValue } from "./recipe-schema.ts";
import { ingredientLine, recipe, recipeTag, tag, user } from "./db/schema.ts";
import { FACETS, type Facet } from "./db/tags.ts";

/**
 * Reading a single Recipe.
 *
 * Every read path filters `deleted_at` — soft-deleted Recipes are gone as far as
 * the app is concerned, and forgetting this in one query is how a deleted Recipe
 * reappears on one screen but not another.
 */

export type RecipeDetail = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  servings: number;
  totalMinutes: number | null;
  kcalPerServing: number | null;
  sourceUrl: string | null;
  steps: string[];
  tips: string[];
  createdAt: Date;
  author: { name: string; image: string | null };
  /** Only set when someone other than the author last touched it. */
  lastEditor: { name: string } | null;
  ingredientLines: {
    id: string;
    quantity: number | null;
    unit: string | null;
    item: string;
    note: string | null;
    substitutes: { item: string; note: string | null }[];
  }[];
  /** In Facet order — meal, cuisine, diet, effort, vibe — so like sits with like. */
  tags: { slug: string; label: string; facet: Facet }[];
};

export async function getRecipeBySlug(
  slug: string,
): Promise<RecipeDetail | null> {
  const rows = await db
    .select({
      recipe: recipe,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(recipe)
    .innerJoin(user, eq(user.id, recipe.authorId))
    .where(and(eq(recipe.slug, slug), isNull(recipe.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;
  const { recipe: row, authorName, authorImage } = rows[0];

  const [lines, tags, editor] = await Promise.all([
    db
      .select()
      .from(ingredientLine)
      .where(eq(ingredientLine.recipeId, row.id))
      .orderBy(asc(ingredientLine.position)),
    db
      .select({ slug: tag.slug, label: tag.label, facet: tag.facet })
      .from(recipeTag)
      .innerJoin(tag, eq(tag.id, recipeTag.tagId))
      .where(eq(recipeTag.recipeId, row.id)),
    row.updatedById && row.updatedById !== row.authorId
      ? db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, row.updatedById))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    imageUrl: row.imageUrl,
    servings: row.servings,
    totalMinutes: row.totalMinutes,
    kcalPerServing: row.kcalPerServing,
    sourceUrl: row.sourceUrl,
    steps: row.steps,
    tips: row.tips,
    createdAt: row.createdAt,
    author: { name: authorName, image: authorImage },
    lastEditor: editor[0] ?? null,
    ingredientLines: lines.map((line) => ({
      id: line.id,
      // numeric comes back from pg as a string; the UI wants a number.
      quantity: line.quantity === null ? null : Number(line.quantity),
      unit: line.unit,
      item: line.item,
      note: line.note,
      substitutes: line.substitutes,
    })),
    tags: tags
      .map((t) => ({ ...t, facet: t.facet as Facet }))
      .sort((a, b) => FACETS.indexOf(a.facet) - FACETS.indexOf(b.facet)),
  };
}

/**
 * The same Recipe, found by id.
 *
 * Resolves the slug and defers to `getRecipeBySlug` rather than duplicating that
 * function's joins and its soft-delete filter — one read path, one place to get
 * the `deleted_at` rule right.
 */
export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
  const [row] = await db
    .select({ slug: recipe.slug })
    .from(recipe)
    .where(and(eq(recipe.id, id), isNull(recipe.deletedAt)))
    .limit(1);

  return row ? getRecipeBySlug(row.slug) : null;
}

/**
 * A Recipe as the editor holds it.
 *
 * Mapped explicitly rather than spread: the read shape carries author, dates and
 * generated ids that the form has no business editing. Substitutes ride along
 * untouched — they are Worker-generated (ADR-0002) and a hand edit must not drop
 * them.
 *
 * Lives here because three screens need the same mapping: the edit route, the
 * re-import diff (OR-46), and whatever review reads next.
 */
export function toFormValue(recipe: RecipeDetail): RecipeFormValue {
  return {
    title: recipe.title,
    servings: recipe.servings,
    totalMinutes: recipe.totalMinutes,
    kcalPerServing: recipe.kcalPerServing,
    sourceUrl: recipe.sourceUrl,
    imageUrl: recipe.imageUrl,
    ingredientLines: recipe.ingredientLines.map((line) => ({
      quantity: line.quantity,
      unit: line.unit,
      item: line.item,
      note: line.note,
      substitutes: line.substitutes,
    })),
    steps: recipe.steps,
    tips: recipe.tips,
    tagSlugs: recipe.tags.map((tag) => tag.slug),
  };
}
