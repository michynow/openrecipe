import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api";

export function useRecipe(slug: string) {
  return useQuery({
    queryKey: ["recipe", slug],
    queryFn: () => api("GET /api/v1/recipes/by-slug/:slug", { params: { slug } }),
    // A 404 is an answer, not a flake.
    retry: (failures, error) => (error as { status?: number }).status !== 404 && failures < 1,
  });
}

/**
 * After a cook log change: the dashboard refetches; Recipes are only marked stale.
 * Refetching the open one would bump `times` under the CookLog's own optimistic
 * +1 (the web holds it for the page view too); the next visit and the offline
 * copy pick up the server's count.
 */
function invalidateAfterCookLog(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["home"] }),
    qc.invalidateQueries({ queryKey: ["recipe"], refetchType: "none" }),
  ]);
}

export function useLogCooked(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("POST /api/v1/recipes/:id/cook-log", { params: { id: recipeId } }),
    onSuccess: () => invalidateAfterCookLog(qc),
  });
}

export function useUndoCooked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api("DELETE /api/v1/cook-log/:entryId", { params: { entryId } }),
    onSuccess: () => invalidateAfterCookLog(qc),
  });
}
