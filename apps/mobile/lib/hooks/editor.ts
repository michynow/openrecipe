import { checkImage, type RecipeInput } from "@openrecipe/core/recipe-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "../api";
import { API_URL, getCookie } from "../auth";
import { signOut } from "../sign-out";

type Client = ReturnType<typeof useQueryClient>;

/** What the web's save/delete actions revalidate: the home feed and search results. */
const refreshLists = (qc: Client) =>
  Promise.all([qc.invalidateQueries({ queryKey: ["home"] }), qc.invalidateQueries({ queryKey: ["search"] })]);

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => api("POST /api/v1/recipes", { body: input }),
    onSuccess: (res) => (res.ok ? refreshLists(qc) : undefined),
  });
}

export function useUpdateRecipe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => api("PUT /api/v1/recipes/:id", { params: { id }, body: input }),
    onSuccess: (res) =>
      res.ok
        ? Promise.all([refreshLists(qc), qc.invalidateQueries({ queryKey: ["recipe"] })])
        : undefined,
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api("DELETE /api/v1/recipes/:id", { params: { id } }),
    // "none": refetching the open Recipe now would flash a 404 before the screen closes.
    onSuccess: () =>
      Promise.all([refreshLists(qc), qc.invalidateQueries({ queryKey: ["recipe"], refetchType: "none" })]),
  });
}

export function useRestoreRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api("POST /api/v1/recipes/:id/restore", { params: { id } }),
    onSuccess: () => Promise.all([refreshLists(qc), qc.invalidateQueries({ queryKey: ["recipe"] })]),
  });
}

export function useReimport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api("POST /api/v1/recipes/:id/reimport", { params: { id } }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["drafts"] }), qc.invalidateQueries({ queryKey: ["home"] })]),
  });
}

/** Thrown with the Polish message from core's `checkImage`. */
export class ImageRejected extends Error {}

/**
 * Upload a local (already resized, WebP) image: raw bytes, not JSON, so not
 * `api()`. Admin-only on the server.
 */
export async function uploadImage(localUri: string, signal?: AbortSignal): Promise<string> {
  const bytes = await fetch(localUri, { signal }).then((r) => r.arrayBuffer());
  const rejected = checkImage({ type: "image/webp", size: bytes.byteLength });
  if (rejected) throw new ImageRejected(rejected);

  const res = await fetch(`${API_URL}/api/v1/images`, {
    method: "POST",
    headers: { "Content-Type": "image/webp", Cookie: getCookie() },
    credentials: "omit",
    body: bytes,
    signal,
  });
  if (!res.ok) {
    if (res.status === 401) await signOut();
    throw new ApiError(res.status, null);
  }
  return ((await res.json()) as { url: string }).url;
}

/** Drops an uploaded-then-abandoned blob. Best effort: a failure only leaves an orphan. */
export function deleteUploadedImage(url: string): Promise<unknown> {
  return api("POST /api/v1/images/delete", { body: { url } }).catch(() => {});
}
