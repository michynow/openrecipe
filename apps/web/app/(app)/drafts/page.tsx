import { notFound } from "next/navigation";

import { DraftList } from "@/components/draft-list";
import { ParkUrlForm } from "@/components/park-url-form";
import { SectionCard } from "@/components/section-card";
import { copy } from "@openrecipe/core/copy";
import { listDrafts } from "@/lib/draft-queue";
import { requireUser } from "@/lib/session";

/**
 * The Drafts screen (OR-39, OR-45): park a link, and see what has become of the
 * ones already parked.
 *
 * The header has linked here since the app shell was built, and until now the
 * route did not exist. Parking and the queue live on one screen deliberately —
 * they are the same activity seen a minute apart.
 */
export default async function DraftsPage() {
  // Members are read-only; 404 rather than 403, like Settings.
  if (!(await requireUser()).isAdmin) notFound();

  const drafts = await listDrafts();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-tight">
        {copy.imports.draftsTitle}
      </h1>

      <SectionCard number="01" icon="link" label={copy.imports.parkTitle}>
        <ParkUrlForm />
      </SectionCard>

      <DraftList drafts={drafts} />
    </main>
  );
}
