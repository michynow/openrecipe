import Link from "next/link";
import { notFound } from "next/navigation";

import { NewRecipeForm } from "@/components/new-recipe-form";
import { copy } from "@openrecipe/core/copy";
import { emptyRecipe, httpUrlSchema } from "@openrecipe/core/recipe-schema";
import { requireUser } from "@/lib/session";
import { getTagsByFacet } from "@/lib/tags-query";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  // Proxy redirects anonymous visitors, but this page also refuses on its
  // own — the proxy guard is a redirect, not authorisation.
  // Members are read-only; 404 rather than 403, like Settings.
  if (!(await requireUser()).isAdmin) notFound();

  // Read on the server so the picker ships with its options already in the HTML.
  const tagGroups = await getTagsByFacet();

  /**
   * `?source=` arrives from a failed Draft's "wpisz ręcznie" (OR-45): the import
   * did not work, but the link is still worth keeping as provenance. Validated
   * rather than trusted — this is a URL out of the address bar, and it ends up
   * in an href.
   */
  const { source } = await searchParams;
  const parsedSource = httpUrlSchema.safeParse(source ?? "");
  const initial = parsedSource.success
    ? { ...emptyRecipe, sourceUrl: parsedSource.data }
    : undefined;

  return (
    <>
      {/*
        PRD §7.3 asks for one entry point offering both ways in. The link is the
        whole affordance: parking a URL is a one-field job that lives on /drafts
        next to the queue it feeds, and duplicating that form here would put two
        competing "add a Recipe" forms on one screen.
      */}
      <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
        <Link
          href="/drafts"
          className="text-sm text-accent underline underline-offset-4"
        >
          {copy.imports.orPasteLink}
        </Link>
      </div>

      <NewRecipeForm
        heading={copy.editor.newTitle}
        tagGroups={tagGroups}
        initial={initial}
      />
    </>
  );
}
