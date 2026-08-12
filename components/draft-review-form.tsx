"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { approveDraftAction, discardDraftAction } from "@/app/(app)/drafts/actions";
import { Icon } from "@/components/icons";
import { RecipeEditor, type RecipeEditorValue } from "@/components/recipe-editor";
import { copy } from "@/lib/copy";
import type { FacetGroup } from "@/lib/tags-query";

/**
 * Draft review (OR-44). The Phase 1 editor, mounted on a machine-made payload —
 * no second form component, which was the whole reason the editor was built
 * before import existed.
 *
 * Three additions and nothing else: a banner naming where this came from, the
 * Worker's own list of guessed fields, and Discard next to Approve.
 */
export function DraftReviewForm({
  draftId,
  sourceUrl,
  initial,
  inferred,
  tagGroups,
}: {
  draftId: string;
  sourceUrl: string;
  initial: RecipeEditorValue;
  inferred: string[];
  tagGroups: FacetGroup[];
}) {
  const router = useRouter();
  const [discarding, setDiscarding] = useState(false);

  async function discard() {
    if (!window.confirm(copy.imports.discardConfirm)) return;

    setDiscarding(true);
    const result = await discardDraftAction(draftId);
    if (result.ok) router.push("/drafts");
    else setDiscarding(false);
  }

  return (
    <RecipeEditor
      heading={copy.imports.reviewTitle}
      tagGroups={tagGroups}
      initial={initial}
      inferred={inferred}
      submitLabel={copy.imports.approve}
      onSubmit={(value: RecipeEditorValue) => approveDraftAction(draftId, value)}
      banner={
        <div className="flex flex-col gap-1 rounded-card border border-accent/40 bg-surface p-3">
          <p className="text-sm">{copy.imports.reviewHint}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Icon name="link" className="size-4 shrink-0" />
            <span className="shrink-0">{copy.imports.fromSource}</span>
            {/*
              rel: this is a link somebody pasted, opened from a page that knows
              the reader is signed in. noopener is the load-bearing half.
            */}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 break-all text-accent underline underline-offset-4"
            >
              {sourceUrl}
            </a>
          </p>
        </div>
      }
      extraActions={
        <button
          type="button"
          onClick={discard}
          disabled={discarding}
          className="rounded-input border border-line px-4 py-2.5 text-muted transition-colors hover:text-accent2 disabled:opacity-50"
        >
          {copy.imports.discard}
        </button>
      }
    />
  );
}
