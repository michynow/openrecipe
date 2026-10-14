/**
 * Which queries survive an app restart (offline cache), kept pure so node can test it.
 * Only opened Recipes are worth the storage: everything else is cheap to refetch
 * and stale the moment it is saved.
 */

export const MAX_PERSISTED_RECIPES = 20;

type Persistable = { queryKey: readonly unknown[]; state: { status: string } };

export const isRecipeKey = (key: readonly unknown[]) => key[0] === "recipe";

/** Successful ["recipe", …] queries only. */
export const shouldPersist = (query: Persistable) =>
  isRecipeKey(query.queryKey) && query.state.status === "success";

/** Keeps the `max` most recently fetched Recipes; other queries pass through. */
export function pruneRecipes<T extends { queryKey: readonly unknown[]; state: { dataUpdatedAt: number } }>(
  queries: T[],
  max = MAX_PERSISTED_RECIPES,
): T[] {
  const keep = new Set(
    queries
      .filter((q) => isRecipeKey(q.queryKey))
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
      .slice(0, max),
  );
  return queries.filter((q) => !isRecipeKey(q.queryKey) || keep.has(q));
}
