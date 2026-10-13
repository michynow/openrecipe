import { notFound } from "next/navigation";

import { DraftReviewForm } from "@/components/draft-review-form";
import { getDraftForReview } from "@/lib/draft-queue";
import { requireUser } from "@/lib/session";
import { getTagsByFacet } from "@/lib/tags-query";

/**
 * Reviewing one Draft (OR-44).
 *
 * A Draft that is not `ready`, or whose payload no longer parses, renders the
 * Polish 404 rather than an editor full of fields the save would reject.
 */
export default async function DraftReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Members are read-only; 404 rather than 403, like Settings.
  if (!(await requireUser()).isAdmin) notFound();

  const { id } = await params;
  const draft = await getDraftForReview(id);
  if (!draft) notFound();

  const tagGroups = await getTagsByFacet();

  return (
    <DraftReviewForm
      draftId={draft.id}
      sourceUrl={draft.sourceUrl}
      initial={draft.payload}
      inferred={draft.inferred}
      tagGroups={tagGroups}
      recipeId={draft.recipeId}
      current={draft.current}
    />
  );
}
