import type { ShoppingListResult } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { withTick, type ShoppingList } from "@openrecipe/core/shopping-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "../../components/ui/toast";
import { api } from "../api";

const KEY = ["shopping-list"];

/** The list is shared, so it needs the network: no stale offline copy. */
export function useShoppingList() {
  return useQuery({ queryKey: KEY, queryFn: () => api("GET /api/v1/shopping-list") });
}

/** Shared by every mutation: store the answer, refresh the Recipe page's badge. */
function useListMutation<V>(fn: (v: V) => Promise<ShoppingListResult>, optimistic?: (list: ShoppingList, v: V) => ShoppingList) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: async (v: V) => {
      if (!optimistic) return undefined;
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<ShoppingList>(KEY);
      if (prev) qc.setQueryData(KEY, optimistic(prev, v));
      return { prev };
    },
    onSuccess: (res) => {
      if (!res.ok) showToast({ message: copy.common.somethingFailed });
      qc.setQueryData(KEY, res.list);
      qc.invalidateQueries({ queryKey: ["recipe"] });
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      showToast({ message: copy.common.somethingFailed });
    },
  });
}

export const useAddToShoppingList = () =>
  useListMutation((body: { recipeId: string; servings: number; excludedLineIds?: string[] }) =>
    api("POST /api/v1/shopping-list/recipes", { body }),
  );

export const useSetShoppingListServings = () =>
  useListMutation((v: { recipeId: string; servings: number }) =>
    api("PATCH /api/v1/shopping-list/recipes/:recipeId", { params: { recipeId: v.recipeId }, body: { servings: v.servings } }),
  );

export const useRemoveFromShoppingList = () =>
  useListMutation((recipeId: string) => api("DELETE /api/v1/shopping-list/recipes/:recipeId", { params: { recipeId } }));

export const useTickShoppingItem = () =>
  useListMutation(
    (body: { key: string; ticked: boolean }) => api("POST /api/v1/shopping-list/ticks", { body }),
    (list, v) => withTick(list, v.key, v.ticked),
  );

export const useClearShoppingList = () =>
  useListMutation((scope: "ticked" | "all") => api("POST /api/v1/shopping-list/clear", { body: { scope } }));
