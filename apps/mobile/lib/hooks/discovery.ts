import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { searchApiQuery } from "@openrecipe/core/search-params";

import { api } from "../api";

export const useHome = () => useQuery({ queryKey: ["home"], queryFn: () => api("GET /api/v1/home") });

export function useReroll() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api("POST /api/v1/home/reroll"),
    onSuccess: () => client.invalidateQueries({ queryKey: ["home"] }),
  });
}

export const useTags = () =>
  useQuery({
    queryKey: ["tags"],
    queryFn: () => api("GET /api/v1/tags"),
    staleTime: 60 * 60 * 1000,
  });

/** `qs` is the canonical string from core `searchFiltersToQuery`; pages follow `nextCursor`. */
export const useSearch = (qs: string) =>
  useInfiniteQuery({
    queryKey: ["search", qs],
    queryFn: ({ pageParam }) => api("GET /api/v1/search", { query: searchApiQuery(qs, pageParam) }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
