"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { reimportAction } from "@/app/(app)/drafts/actions";
import { DRAFTS_CHANGED } from "@/components/draft-toasts";
import { Icon } from "@/components/icons";
import { copy } from "@/lib/copy";

/**
 * "Import this one again" (OR-46), shown only on a Recipe that has a Source URL.
 *
 * Nothing changes here and now: it queues a Draft carrying this Recipe's id, and
 * the Worker fills it in. What comes back is a diff to review, not an overwrite —
 * which is the whole point, since somebody's hand corrections are in the version
 * that already exists.
 */
export function ReimportButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [queued, setQueued] = useState(false);

  async function run() {
    setPending(true);
    const result = await reimportAction(recipeId);
    setPending(false);

    if (!result.ok) return;

    setQueued(true);
    window.dispatchEvent(new Event(DRAFTS_CHANGED));
    router.refresh();
  }

  if (queued) {
    return (
      <span role="status" className="inline-flex min-h-11 items-center text-sm font-bold text-accent">
        {copy.imports.reimportQueued}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-2 rounded-input border border-line px-3 text-sm font-extrabold text-text disabled:opacity-50"
    >
      <Icon name="refresh" className="size-5" />
      {copy.imports.reimport}
    </button>
  );
}
