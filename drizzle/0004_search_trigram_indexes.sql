-- Search foundation (OR-34). Hand-written, because drizzle-kit cannot express an
-- extension or an index over a function call — see the note in lib/db/schema.ts.

CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- `unaccent(text)` is STABLE, not IMMUTABLE, so Postgres rejects it inside an
-- index expression outright. It is STABLE because the one-argument form looks its
-- dictionary up through `search_path`, and a changed search_path would silently
-- change the result — which is exactly what would corrupt an index.
--
-- The fix is the two-argument form, which names the dictionary instead of
-- resolving it, wrapped in a function we can honestly declare IMMUTABLE.
-- Everything is schema-qualified so the promise holds whatever search_path the
-- caller arrives with.
--
-- The consequence to remember: if the `unaccent` dictionary is ever reconfigured,
-- both indexes below are stale and have to be REINDEXed. Nothing reconfigures it.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  STRICT
  PARALLEL SAFE
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint

-- Both sides of every comparison in lib/search-query.ts go through
-- immutable_unaccent(lower(...)), which is what lets these indexes serve it. The
-- interface is Polish: `zurek` has to find `Żurek`, `losos` has to find `łosoś`.
CREATE INDEX "recipe_title_trgm_idx" ON "recipe"
  USING gin (public.immutable_unaccent(lower("title")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ingredient_line_item_trgm_idx" ON "ingredient_line"
  USING gin (public.immutable_unaccent(lower("item")) gin_trgm_ops);
