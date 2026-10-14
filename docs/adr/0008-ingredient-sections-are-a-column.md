# Ingredient sections are a nullable column on the line, kept contiguous

Plenty of Recipes come in parts — "Ciasto", "Sos", "Do podania". Each Ingredient Line
gets an optional `section` (text, null = ungrouped). There is no section table.

Considered:

- **A `ingredient_section` table** with its own position, lines pointing at it. Gives a
  section identity (empty sections, rename by id), at the price of a second ordered
  list to keep in step with the first, a second insert per save, and a second thing
  the Worker's JSON and the Draft payload have to describe. Sections have no
  attributes beyond a name, so the identity buys nothing anyone asked for.
- **Heading rows mixed into the lines** (`kind: "heading"`). Every consumer of
  Ingredient Lines — scaling, Pantry Check, Substitutes, Shopping Export, search,
  the diff — would have to learn to skip them. Rejected.
- **A column on the line** (chosen). Reorder stays one array; the Recipe schema, the
  Draft payload and the model's JSON each grow one nullable field.

## The one rule: contiguous, ungrouped first

`recipeSchema` normalises the list on parse (`normalizeSections` in
`packages/core/src/sections.ts`): ungrouped lines first, then each section's lines
together, in the order the sections first appear; within a group, order is kept.
Every write goes through that parse, so every stored Recipe and every Draft payload
satisfies it, and a reader can group by "consecutive lines with the same section"
without ever showing the same heading twice. Ungrouped lines go first because a line
without a heading placed after a section would read as part of it.

Editors move lines with `moveLine` (a splice that adopts the section of the line it
just passed), so dragging across a heading changes the section and keyboard arrows
can reach every position. A section with no lines does not exist — adding one
starts it with a blank line.

## Consequences

- Section names are compared exactly after trimming: "Sos" and "sos" are two sections.
- The import keeps sections: JSON-LD has no field for them, so the extractor reads
  them from heading-like `recipeIngredient` entries ("Sos:") and from the page's own
  headings above the ingredient list; the model is told to keep the page's groups and
  never to invent them.
- The re-import diff matches lines by item, not section, so moving a line between
  sections shows as a change, not a removal plus an addition.
- Pantry Check ticks still key on line id; sections do not touch them (ADR-0004).
