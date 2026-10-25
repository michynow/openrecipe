import type { RecipeInput } from "@openrecipe/core/recipe-schema";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api } from "../api";
import { askForPush } from "../push";

const invalidateList = (qc: QueryClient) =>
  Promise.all([qc.invalidateQueries({ queryKey: ["drafts"] }), qc.invalidateQueries({ queryKey: ["home"] })]);

/** Refetches every 5 s while anything is queued or processing; focusManager pauses it in the background. */
export const useDrafts = (enabled: boolean) =>
  useQuery({
    queryKey: ["drafts"],
    enabled,
    queryFn: () => api("GET /api/v1/drafts"),
    refetchInterval: (q) =>
      q.state.data?.some((d) => d.status === "queued" || d.status === "processing") ? 5000 : false,
  });

/** A link, or the recipe's own text pasted instead of one. */
export function useParkUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { sourceUrl: string } | { sourceText: string }) => api("POST /api/v1/drafts", { body }),
    onSuccess: () => {
      void askForPush();
      return invalidateList(qc);
    },
  });
}

export const useDraft = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["draft", id],
    enabled,
    queryFn: () => api("GET /api/v1/drafts/:id", { params: { id } }),
    retry: (failures, error) => (error as { status?: number }).status !== 404 && failures < 1,
  });

export function useApproveDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { input: RecipeInput; recipeId?: string }) =>
      api("POST /api/v1/drafts/:id/approve", { params: { id }, body: v }),
    onSuccess: (res) => {
      if (!res.ok) return;
      return Promise.all([
        qc.invalidateQueries({ queryKey: ["drafts"] }),
        qc.invalidateQueries({ queryKey: ["home"] }),
        qc.invalidateQueries({ queryKey: ["search"] }),
        qc.invalidateQueries({ queryKey: ["recipe"] }),
      ]);
    },
  });
}

function useDraftAction(endpoint: "POST /api/v1/drafts/:id/retry" | "POST /api/v1/drafts/:id/discard") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(endpoint, { params: { id } }),
    onSuccess: (_res, id) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["drafts"] }),
        qc.invalidateQueries({ queryKey: ["draft", id] }),
      ]),
  });
}

export const useRetryDraft = () => useDraftAction("POST /api/v1/drafts/:id/retry");
export const useDiscardDraft = () => useDraftAction("POST /api/v1/drafts/:id/discard");

/** What the toast poller reads. Admin only; `enabled` gates it for everyone else. */
export const useDraftPulse = (enabled: boolean) =>
  useQuery({
    queryKey: ["drafts", "pulse"],
    queryFn: () => api("GET /api/v1/drafts/pulse"),
    enabled,
    refetchInterval: 5000,
    // The first poll is a baseline; never serve a cached one as news.
    gcTime: 0,
  });
