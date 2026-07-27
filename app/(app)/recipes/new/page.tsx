import { NewRecipeForm } from "@/components/new-recipe-form";
import { copy } from "@/lib/copy";
import { requireUser } from "@/lib/session";

export default async function NewRecipePage() {
  // Middleware redirects anonymous visitors, but this page also refuses on its
  // own — middleware is a redirect, not authorisation.
  await requireUser();

  return <NewRecipeForm heading={copy.editor.newTitle} />;
}
