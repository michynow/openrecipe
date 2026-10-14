import { copy } from "@openrecipe/core/copy";
import { finishedSince, type DraftPulse, type DraftStatus } from "@openrecipe/core/drafts";

export type PulseToast = {
  id: string;
  message: string;
  actionLabel: string;
  href: string;
};

export const pulseMap = (drafts: readonly DraftPulse[]): Map<string, DraftStatus> =>
  new Map(drafts.map((d) => [d.id, d.status]));

/**
 * Which toasts a poll earns. `before` is null on the first poll, a baseline and
 * not news. The Draft open in review is skipped: its screen already shows it.
 */
export function pulseToasts(
  before: ReadonlyMap<string, DraftStatus> | null,
  now: readonly DraftPulse[],
  openDraftId: string | null,
): PulseToast[] {
  if (!before) return [];
  return finishedSince(before, now)
    .filter((d) => d.id !== openDraftId)
    .map((d) =>
      d.status === "ready"
        ? { id: d.id, message: copy.imports.toastReady(d.title), actionLabel: copy.imports.review, href: `/drafts/${d.id}` }
        : { id: d.id, message: copy.imports.toastFailed, actionLabel: copy.imports.toastOpenDrafts, href: "/drafts" },
    );
}
