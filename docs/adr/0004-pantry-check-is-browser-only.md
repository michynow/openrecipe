# The Pantry Check lives in the browser and expires in a day

A reader's ticks against a Recipe's Ingredient Lines are stored in `localStorage`, keyed
by Recipe id, stamped with a date, and discarded on the first read of a new day. There is
no table for them and no user column anywhere.

Why, given everything else is in Postgres: a Pantry Check is not a fact about the Recipe
or about the person — it's a scratch note about one shopping trip. Persisting it server-
side would mean deciding what happens when two people tick the same Recipe from different
phones, what a stale tick from three weeks ago means, and when to clean it up. None of
those questions have good answers, and all of them disappear if the data is local and
short-lived.

## Consequences

- Ticks do not follow you between devices. Deliberate: you shop with one phone.
- Ticks key on Ingredient Line id, so editing a Recipe's line order doesn't scramble them,
  but deleting a line silently drops its tick — which is correct.
- The Shopping Export is computed entirely client-side from local state.
- Reversible cheaply if it ever annoys: the export already works from a list of line ids,
  so a table could back the same shape.
