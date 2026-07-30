import { NewRecipeForm } from "@/components/new-recipe-form";
import { copy } from "@/lib/copy";
import { requireUser } from "@/lib/session";
import { getTagsByFacet } from "@/lib/tags-query";

export default async function NewRecipePage() {
  // Proxy redirects anonymous visitors, but this page also refuses on its
  // own — the proxy guard is a redirect, not authorisation.
  await requireUser();

  // Read on the server so the picker ships with its options already in the HTML.
  const tagGroups = await getTagsByFacet();

  return <NewRecipeForm heading={copy.editor.newTitle} tagGroups={tagGroups} />;
}
