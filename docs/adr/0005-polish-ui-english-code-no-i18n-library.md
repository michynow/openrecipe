# Polish interface, English code, no i18n library

The interface is entirely Polish. The codebase — identifiers, table and column names,
glossary terms, ADRs, commits, Jira tickets — is entirely English. There is no i18n
library and no locale abstraction: `lib/copy.ts` exports one flat object of Polish strings,
and every user-facing string comes from it.

Three decisions, one reason each.

**Polish UI:** the only people who will ever use this speak Polish. There is no second
audience.

**English code:** mixed-language identifiers rot. `przepis.ingredientLines` invites
`przepis.skladniki` next to it, and then nothing greps cleanly against its own
documentation. The glossary in CONTEXT.md is the shared vocabulary for code and tickets;
its Polish rendering is a presentation detail, listed in one table at the bottom of that
file. `ingredientLine.item` holding `"masło"` is correct — data is Polish, the field name
is not.

**No i18n library:** `next-intl` and its relatives solve *choosing between locales*.
There is one locale and no plan for a second. A library would add a provider, message
catalogues, key namespacing and a build step to deliver what a plain object already does.
If a second language ever appears, `lib/copy.ts` is a keyed object — the shape a message
catalogue wants anyway, so the migration is mechanical.

## Consequences

- **Tag `slug` is English, `label` is Polish.** Queries and code use slugs; only labels
  render. This is why the schema has both columns.
- **Search needs `unaccent`, not just `pg_trgm`.** `zurek` must find `żurek`. The trigram
  index is functional, over `unaccent(lower(...))`.
- **Sorting needs the `pl-PL` collation**, or Ł lands after Z.
- **Plurals need `Intl.PluralRules`.** Polish has three forms — porcja / porcje / porcji.
  `n === 1` branching is simply wrong here.
- **Fonts need the `latin-ext` subset.** A display face without ł is unusable.
- **The Worker translates.** An English source page produces a Polish Recipe. Proper dish
  names survive untranslated.
- Accepted cost: a Polish speaker reading the code sees English names, and an English
  speaker reading the UI sees none of it. Both are fine; nobody does both at once.
