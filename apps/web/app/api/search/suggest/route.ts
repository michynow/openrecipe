import { searchRecipes } from "@/lib/search-query";
import { getCurrentUser } from "@/lib/session";

/**
 * Suggestions for the header's autocomplete (OR-37).
 *
 * A Route Handler rather than a Server Action, for one reason: this call has to be
 * abortable. `fetch` takes an AbortSignal; a Server Action invoked from the client
 * does not, so a stale one would still resolve and drop older results on top of
 * newer ones. Killing the stale request is the point of the ticket, so it decides
 * the shape of the endpoint.
 *
 * The middleware in front of this is a redirect for convenience, not authorisation
 * (see middleware.ts), so the session is checked here. Unchecked, this URL hands
 * the whole library to anyone who guesses it — the app is invite-only for a reason.
 *
 * No query of its own: `searchRecipes` already does the diacritic-insensitive
 * trigram matching, and it returns exactly the fields a suggestion row draws.
 */

/** PRD §7.4: eight rows. Fixed here, never read off the URL. */
const SUGGEST_LIMIT = 8;

export async function GET(request: Request) {
  // 401 with an empty list rather than a bare status: the client renders whatever
  // comes back, so a signed-out caller sees "no results" instead of an error.
  if (!(await getCurrentUser())) {
    return Response.json({ recipes: [] }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  /**
   * An empty query makes `searchRecipes` browse rather than search — it would
   * answer with the newest Recipes, which are not suggestions for anything anyone
   * typed. Guarding here also keeps an empty box from touching the database.
   */
  if (!query) return Response.json({ recipes: [] });

  const { recipes } = await searchRecipes({ query, limit: SUGGEST_LIMIT });

  return Response.json({ recipes });
}
