import type { Facet } from "@openrecipe/core/tags";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api";

/** The session user (shared key with `useMe`); `enabled` keeps it quiet while signed out. */
export const useIsAdmin = (enabled = true) =>
  useQuery({ queryKey: ["me"], queryFn: () => api("GET /api/v1/me"), enabled, select: (m) => m.isAdmin });

export const useSettings = (enabled: boolean) =>
  useQuery({ queryKey: ["settings"], queryFn: () => api("GET /api/v1/settings"), enabled });

/** Settings changes refetch the screen; tag changes also refresh the pickers (editor, search). */
function useSettingsMutation<V, R>(fn: (v: V) => Promise<R>, alsoTags = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        ...(alsoTags ? [qc.invalidateQueries({ queryKey: ["tags"] })] : []),
      ]),
  });
}

export const useMintInvite = () =>
  useSettingsMutation((email: string | null) => api("POST /api/v1/settings/invites", { body: { email } }));

export const useRevokeInvite = () =>
  useSettingsMutation((id: string) => api("DELETE /api/v1/settings/invites/:id", { params: { id } }));

export const useSetMemberRole = () =>
  useSettingsMutation((v: { id: string; role: "admin" | "member" }) =>
    api("PATCH /api/v1/settings/members/:id", { params: { id: v.id }, body: { role: v.role } }),
  );

export const useRemoveMember = () =>
  useSettingsMutation((id: string) => api("DELETE /api/v1/settings/members/:id", { params: { id } }));

export const useAddTag = () =>
  useSettingsMutation(
    (body: { facet: Facet; slug: string; label: string }) => api("POST /api/v1/settings/tags", { body }),
    true,
  );

export const useRenameTag = () =>
  useSettingsMutation(
    (v: { id: string; label: string }) =>
      api("PATCH /api/v1/settings/tags/:id", { params: { id: v.id }, body: { label: v.label } }),
    true,
  );

export const useDeleteTag = () =>
  useSettingsMutation((id: string) => api("DELETE /api/v1/settings/tags/:id", { params: { id } }), true);

export function useUpdateName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api("PATCH /api/v1/account/name", { body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api("POST /api/v1/account/password", { body }),
  });
