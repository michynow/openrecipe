# One Shopping List for the household, on the server, open to Members

The Shopping Export (one Recipe, unticked lines, pasted somewhere) does not cover a
week's shop across several Recipes. We are adding a **Shopping List**: one per
instance, stored in Postgres, shared by everyone signed in.

## Shape

- `shopping_list_entry` — one row per Recipe on the list: `recipe_id` (unique), the
  chosen `servings`, and `excluded` row keys. No list table: there is one household,
  so there is one list.
- `shopping_list_tick` — one row per ticked item, keyed by the merged row's key, with
  the quantity that was on screen when it was ticked.
- Lines are **read live** from the Recipe, not snapshotted. Fixing a typo in a Recipe
  fixes the list; a soft-deleted Recipe drops off it.
- Merging is pure and lives in `packages/core/src/shopping-list.ts`: item text is
  trimmed, lower-cased and space-collapsed (diacritics kept); same item + same unit
  are summed after scaling; the same item in different units stays as separate rows
  under one product heading (no unit conversion — PRD §2); null-quantity ("do smaku")
  lines of one item merge into one unquantified row. Each row lists its Recipes.
- A tick holds while the needed quantity is no more than what was ticked. Adding a
  second Recipe that needs more milk un-ticks the milk — you bought 500 ml, you now
  need a litre.
- "Wyczyść odhaczone" moves each ticked row's key into its source entries'
  `excluded` and drops the ticks; "Wyczyść wszystko" empties both tables.

## Members may use it

CONTEXT.md says Members are read-only, "except logging their own Cook Log entries".
The Shopping List is a second exception: it is household logistics, not library
content. Nothing a Member does to it changes a Recipe, a Tag or anyone's account,
and the person doing the shopping is as likely to be a Member as an Admin. Every
Shopping List action and endpoint uses `requireUser` / `guard("user")`.

## Pantry Check: only unticked lines go on the list

The Pantry Check stays device-local and day-long (ADR-0004). When a Recipe is added
from its page, the client sends the ids of the lines ticked there; the server turns
them into row keys (item + unit) at that moment and stores them as the entry's
`excluded`. Keys rather than line ids because saving a Recipe replaces its lines and
their ids. "I already have eggs" is the whole point of the tick, and ignoring it
would put eggs on the list the reader just said they have. The list shows how many
lines were skipped; re-adding the Recipe (with no ticks) brings them back.

Adding a Recipe already on the list replaces its servings and exclusions — one row
per Recipe.

## Consequences

- Ticks are shared and persistent, unlike the Pantry Check. Two phones ticking the
  same row is last-write-wins, which is fine for one household.
- The single-Recipe Shopping Export stays as it is, renamed in Polish so the two
  don't collide ("Wyślij, czego brakuje" vs "Lista zakupów").
- Unit spellings are not unified: "łyżka" and "łyżki" are different units to the
  merge. Revisit with a singular-form table if it annoys.
