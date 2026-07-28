import { notFound } from "next/navigation";

import { EditRecipeForm } from "@/components/edit-recipe-form";
import { copy } from "@/lib/copy";
import { getRecipeBySlug } from "@/lib/recipe-query";
import type { RecipeFormValue } from "@/lib/recipe-schema";
import { requireUser } from "@/lib/session";
import { getTagsByFacet } from "@/lib/tags-query";

/**
 * Edit an existing Recipe.
 *
 * The same `RecipeEditor` as /recipes/new, handed the Recipe as `initial` and a
 * different submit handler. That reuse is the whole reason the editor was built as
 * a component over the Recipe shape rather than as a "new recipe page".
 *
 * Free-for-all editing (PRD §5): any signed-in user may edit any Recipe, so there
 * is no ownership check.
 */
export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();

  const { slug } = await params;
  const [recipe, tagGroups] = await Promise.all([
    getRecipeBySlug(slug),
    getTagsByFacet(),
  ]);

  // getRecipeBySlug already filters soft-deleted Recipes, so this covers both
  // "never existed" and "deleted" with the same Polish 404.
  if (!recipe) notFound();

  /**
   * The read shape carries things the form has no business editing — author, dates,
   * generated ids — so map explicitly rather than spreading. Substitutes ride along
   * untouched: they are Worker-generated (ADR-0002) and a hand edit must not drop
   * them.
   */
  const initial: RecipeFormValue = {
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
    tagSlugs: recipe.tags.map((t) => t.slug),
  };

  return (
    <EditRecipeForm
      recipeId={recipe.id}
      heading={copy.editor.editTitle}
      initial={initial}
      tagGroups={tagGroups}
    />
  );
}
