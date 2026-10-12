# OpenRecipe — Product Requirements Document

**Status:** Agreed through the grilling session of 2026-07-27. Ready to build.
**Owner:** Michy (Master)
**Glossary:** [CONTEXT.md](./CONTEXT.md) — capitalised terms below are defined there.
**Decisions:** [docs/adr/](./docs/adr/)

---

## 1. What this is

A private, invite-only recipe library for one household, cooked from a phone and
maintained from a laptop. One Master, a handful of Members. Not a product — no signup,
no SEO, no growth, no monetisation.

Recipes arrive two ways:

1. **By hand** — a polished editor.
2. **By import** — park a URL from anywhere; a Worker in GitHub Actions (ADR-0006) turns it
   into a Draft; a human reviews the Draft and approves it into a Recipe.

Look: snack arcade — a cartoon 2D game you cook from. Words: clean and cheeky. Polish is not optional — every state
(empty, loading, error, offline, partial) is designed, not defaulted.

## 2. Non-goals

- Public sign-up, SEO, sharing outside the instance.
- Meal-plan calendars, week planners, pantry inventory tracked over time.
- Nutrition computed from an ingredient database (kcal is a hand-entered or scraped number).
- Native apps. Responsive web, phone-first for the cooking view.
- Unit conversion between metric and imperial.
- Any LLM call from the deployed app. See [ADR-0002](./docs/adr/0002-ai-runs-on-a-local-worker.md).

## 3. Hard constraints

| Constraint | Consequence |
|---|---|
| £0 running cost | Vercel Hobby, Neon free Postgres, Vercel Blob free allotment, no metered AI API |
| Deploys to Vercel | Single Next.js app; Hobby functions may run up to 300s |
| Next.js + TypeScript + Tailwind | Fixed by the brief |
| Reuse existing Claude subscription | Inference only runs where the `claude` CLI exists — the laptop |

## 4. Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js App Router, TypeScript | Brief |
| Styling | Tailwind, theme tokens only — no hex in components | Theme is a config file |
| Data | Neon Postgres + Drizzle ORM | Free, serverless driver, typed schema shared with the Worker |
| Mutations | Server Actions | No hand-written endpoints for CRUD |
| Auth | Better Auth | [ADR-0003](./docs/adr/0003-better-auth-over-nextauth.md) |
| Files | Vercel Blob | Owns its images, immune to hotlink rot |
| Validation | Zod, one schema shared by form, Server Action and Worker | Single source of truth |
| Worker | Node script, Claude Agent SDK, `sharp`, `cheerio` | Runs in GitHub Actions, woken by the app (ADR-0006); the laptop still works. Writes to Neon |
| No NestJS | — | [ADR-0001](./docs/adr/0001-single-nextjs-app-no-nestjs.md) |

## 5. Roles and access

| | Master | Member |
|---|---|---|
| View Recipes | ✓ | ✓ |
| Create / edit any Recipe | ✓ | ✓ |
| Delete any Recipe | ✓ | ✓ (confirm dialog, soft delete) |
| Park a URL for import | ✓ | ✓ |
| Approve a Draft | ✓ | ✓ |
| Settings: invites, members, tags | ✓ | — |
| Run the Worker | ✓ | — |

- **Free-for-all on Recipes.** It's one household's cookbook, not personal folders.
- Delete requires an explicit confirm dialog naming the Recipe, and is a soft delete
  (`deleted_at`), so the confirm is backed by an undo toast rather than by hope.
- `author_id` never changes. The page also shows the last editor when it differs.
- Master is derived at login by matching `MASTER_EMAIL` — never grantable in the UI.

### Auth flows

- **Login only.** No register link anywhere.
- Email + password, and Google. Both resolve to the same account on matching email
  (Better Auth trusted-provider linking).
- Accounts exist only via an Invite: single-use token, 7-day expiry, optionally bound to
  an email address, revocable.
- No email provider, therefore **no self-service password reset** — the Master mints a
  reset link and hands it over the same way as an Invite.

## 6. Domain model

Identity where it's needed, JSON where it isn't:

- **Ingredient Lines are rows.** They carry Substitutes, they're individually ticked,
  and they're reordered — they need identity.
- **Steps and Tips are JSON arrays of strings.** They have no identity, no attributes,
  and are always edited as a whole block. A table would buy nothing.

```sql
-- better-auth owns: user, session, account, verification
-- extended on user: role ('master' | 'member'), name, image

invite
  id           uuid pk
  token        text unique
  email        text null          -- optional pre-binding
  expires_at   timestamptz        -- created_at + 7 days
  used_at      timestamptz null
  used_by      uuid null -> user
  created_by   uuid -> user
  created_at   timestamptz

recipe
  id                uuid pk
  slug              text unique       -- from title, collision-suffixed
  title             text not null
  image_url         text null         -- Blob URL; null is first-class
  servings          int not null      -- what stored quantities produce
  total_minutes     int null
  kcal_per_serving  int null
  source_url        text null
  author_id         text -> user      -- immutable. text, not uuid: Better Auth
  updated_by_id     text null -> user -- issues text ids, so the FK must match.
  steps             jsonb not null default '[]'   -- string[]
  tips              jsonb not null default '[]'   -- string[]
  created_at, updated_at, deleted_at timestamptz

ingredient_line
  id           uuid pk
  recipe_id    uuid -> recipe on delete cascade
  position     int not null
  quantity     numeric null      -- null = "to taste"; scales
  unit         text null         -- free text: g, ml, tbsp, clove
  item         text not null     -- "butter"
  note         text null         -- "melted"
  substitutes  jsonb not null default '[]'
               -- [{ item, note }] - Worker-generated, stored, never live

tag
  id      uuid pk
  facet   text not null    -- meal_slot | cuisine | diet | effort | vibe
  slug    text unique
  label   text not null

recipe_tag
  recipe_id, tag_id  composite pk
  -- max 5 per recipe, enforced in Zod and by a trigger

cook_log
  id         uuid pk
  recipe_id  uuid -> recipe
  user_id    uuid -> user
  cooked_at  timestamptz default now()

proposal_reroll               -- one row per person per day, only while they reroll
  user_id  uuid -> user
  day      date
  n        int not null default 0
  primary key (user_id, day)
  -- joins the Proposal seed. No row means n = 0, so the common case writes nothing.

draft                         -- also the import queue; status is the difference
  id           uuid pk
  source_url   text not null
  status       text not null  -- queued | processing | ready | failed
                              -- | approved | discarded
  payload      jsonb null     -- the full recipe shape, editable pre-approval
  error        text null      -- human-readable failure, shown in the UI
  recipe_id    uuid null      -- set on approve; also set upfront when
                              -- re-importing over an existing Recipe
  created_by   uuid -> user
  created_at, processed_at timestamptz
```

Indexes: `unaccent` + `pg_trgm` GIN on `unaccent(lower(recipe.title))` and
`unaccent(lower(ingredient_line.item))` — functional indexes, because the interface is
Polish and search must ignore diacritics; btree on `(created_at desc, id desc)` for keyset
paging; btree on `draft.status`, `cook_log.recipe_id`, `cook_log.cooked_at`.

### Tag taxonomy (seeded, Master-extensible)

`slug` is English and is what code and queries use. `label` is Polish and is the only part
ever rendered.

| Facet (`facet`) | `slug` → `label` |
|---|---|
| **Meal Slot** (`meal_slot`) | breakfast → Śniadanie · brunch → Brunch · lunch → Obiad · dinner → Kolacja · snack → Przekąska · dessert → Deser · drink → Napój · side → Dodatek · sauce → Sos |
| **Cuisine** (`cuisine`) | polish → Polska · italian → Włoska · french → Francuska · greek → Grecka · mexican → Meksykańska · asian → Azjatycka · japanese → Japońska · thai → Tajska · indian → Indyjska · middle-eastern → Bliskowschodnia · american → Amerykańska · mediterranean → Śródziemnomorska |
| **Diet** (`diet`) | vegetarian → Wegetariańskie · vegan → Wegańskie · gluten-free → Bezglutenowe · dairy-free → Bez laktozy · high-protein → Wysokobiałkowe · low-carb → Niskowęglowodanowe |
| **Effort** (`effort`) | under-15 → Do 15 minut · under-30 → Do 30 minut · one-pan → Jedna patelnia · no-cook → Bez gotowania · slow-cooked → Długo duszone · meal-prep → Na zapas · batch-cook → Duża porcja |
| **Vibe** (`vibe`) | spicy → Ostre · sweet → Słodkie · savoury → Wytrawne · creamy → Kremowe · fresh → Świeże · comfort → Comfort food · fast-food → Fast food · healthy → Zdrowe · fancy → Na wypas · boozy → Z alkoholem · hangover-cure → Na kaca |

Max **5 Tags per Recipe**, any mix of Facets. Meal Slot is the only Facet with behaviour
attached (it drives Proposals). Note `Kolacja` for `dinner`: Polish meal structure puts
the main meal at *obiad*, so the Proposals row reads Śniadanie / Obiad / Kolacja.

## 7. Screens

### 7.1 `/login`

One screen. Email + password, and "Continue with Google". No register link, no
"forgot password" self-service (a line explains the Master issues resets).
Invalid credentials fail identically whether the email exists or not.

### 7.2 `/join/[token]`

The only route that creates an account. Validates the token first and says plainly if
it's used, expired or unknown. Then name + password, or Google. Consumes the token
atomically — a double-submit cannot mint two accounts.

### 7.3 `/` — Dashboard

1. **Stat widgets** — total Recipes, added this week, cooked this week, Drafts waiting
   (links to the Draft list), most-cooked, longest-neglected.
2. **Today's Proposals** — three cards: breakfast, lunch, dinner. Each is picked from
   Recipes carrying that Meal Slot Tag, seeded by `(date, slot)` so it holds still all
   day for everyone. Excludes anything in the Cook Log from the last 7 days. Recipes
   with no Meal Slot Tag form a fallback pool, labelled *wildcard*, so nothing is
   invisible. One query per slot:
   `ORDER BY md5(id::text || :seed)  LIMIT 1`.

   **Reroll** bumps a per-user, per-day counter held in the database, which joins the
   seed. So a reroll survives a refresh, follows you from laptop to phone, and resets on
   its own tomorrow — no cleanup job. Each person rerolls independently; yours doesn't
   change what anyone else sees.
3. **The library** — recent Recipes, grid, links to `/search` for everything.
4. **Add** — one entry point offering both *type it out* and *park a link*.

### 7.4 `/search`

- Trigram search over Recipe title and Ingredient Line item, typo-tolerant **and
  diacritic-insensitive** — `zurek` finds `żurek`, `jajka` finds `Jajka`.
- Filters sectioned by Facet; multi-select within a Facet is OR, across Facets is AND.
- Additional filters: max total minutes, has-image.
- Autocomplete on the search box: `LIMIT 8`, each row a thumbnail + title + its Tags.
- Infinite scroll on keyset cursor `(created_at, id)` — never OFFSET, which
  double-shows rows when something is added mid-scroll.
- Filter state lives in the URL, so a filtered view is back-button-safe and linkable.

### 7.5 `/recipes/[slug]` — Recipe page

Phone-first; this is the screen used with greasy hands.

- Hero image or themed placeholder.
- Title, author (name + avatar), added date, last editor when different, up to 5 Tags,
  total time, kcal per serving, source link. **Null fields render as nothing** — no
  "unknown", no em-dashes.
- **Servings stepper.** Scales `quantity` only; renders as fractions (`0.375` → `⅜`,
  `1.5` → `1½`). Lines with no quantity are untouched. Scaling is display-only and never
  written back.
- **Ingredient Lines with tick boxes** — the Pantry Check. Tapping an Ingredient Line
  opens its stored Substitutes in a sheet; no network, no model.
- **Keep screen awake** toggle — Screen Wake Lock API. Supported on Chrome/Edge and on
  iOS Safari 16.4+; where unsupported the toggle is absent, not broken. Released on
  page hide and on navigation away.
- **Share shopping list** — the unticked lines at the current scale, as formatted text,
  through `navigator.share()`, falling back to clipboard + toast.
- **Steps** — numbered, one line each, deliberately terse.
- **Tips** — at the bottom, after the Steps.
- **"I made this"** — writes a Cook Log entry, optimistic, with an undo window.

### 7.6 `/recipes/[slug]/edit` and `/recipes/new`

**One component, three jobs:** manual create, manual edit, and Draft review. This is why
the editor gets built before import.

- Ingredient Lines: add, remove, drag to reorder, and a paste-a-block affordance that
  splits pasted text into one line per row.
- Tag picker grouped by Facet, hard-stopping at 5 with an explanation rather than a
  silent no-op.
- Image: drop or pick, uploaded to Blob, resized before upload, with progress and a
  remove option.
- Inline validation on blur, submit blocked with focus moved to the first offending
  field and an error summary linked to it.
- Unsaved-changes guard on navigation.
- In Draft-review mode: a banner naming the source, per-field markers on anything the
  Worker guessed, **Approve** and **Discard**.

### 7.7 `/drafts`

List of Drafts by status. Queued items show as waiting for the Worker. Failed items show
the actual reason and offer retry or *type it myself instead*. Ready items link into the
editor in review mode.

### 7.8 `/settings` — Master only

Invites (mint, copy, revoke, expiry countdown), Members (list, remove), Tags (add,
rename, per Facet), and a read-only queue summary. Non-Masters get a 404, not a 403 —
the screen doesn't advertise itself.

## 8. Import pipeline

```
phone/anywhere      park URL              -> draft(status=queued)
laptop  worker      claim                 -> status=processing
                    fetch HTML
                    JSON-LD @type=Recipe?
                      yes -> name, image, recipeIngredient[],
                             recipeInstructions[], recipeYield,
                             nutrition.calories, totalTime, author
                      no  -> strip nav/ads/comments, keep readable text
                    Claude (structured output, the shared Zod schema):
                      split each ingredient line into
                        quantity / unit / item / note
                      pick <=5 Tags from the closed list
                      compress steps to one line each
                      write Tips
                      write 2-3 Substitutes per Ingredient Line
                    download image -> resize 1200w webp -> Blob
                    -> draft(status=ready, payload, confidence flags)
phone               review in the editor  -> approve -> Recipe
                                          -> discard -> status=discarded
```

Rules:

- **Nothing is ever published without a human approving it.** No auto-approve, no
  "trusted site" bypass.
- The model is never asked what the ingredients *are* when JSON-LD says so — only how to
  structure them. This is the difference between a wrong split (visible, fixable in
  review) and an invented ingredient (invisible).
- Tags come from the closed list; the model cannot mint new ones.
- Failures are legible and specific: no markup found, fetch blocked, page not a recipe,
  model returned nothing usable. Never a spinner that stops.
- The Worker is idempotent and claims rows atomically, so running it twice is harmless.
- Re-import over an existing Recipe sets `draft.recipe_id` upfront and the review screen
  diffs against the current Recipe rather than showing a blank slate.

## 9. Cooking mode details

**Pantry Check** — browser-only, expires after one day, belongs to nobody in the
database. See [ADR-0004](./docs/adr/0004-pantry-check-is-browser-only.md).

```
localStorage["openrecipe:pantry:<recipeId>"] = {
  date: "2026-07-27",
  checked: ["<ingredientLineId>", ...]
}
```

Read on mount; if `date` isn't today, drop the entry and start clean. Keyed by
Ingredient Line id, so reordering the recipe doesn't scramble the ticks.

**Shopping Export format** — recipe title, the chosen serving count, the unticked lines
at the current scale, and a count of what was skipped:

```
Ragu — 6 servings

• 750 g beef mince
• 3 tbsp tomato paste
• 1½ onions
• 400 ml red wine

(4 of 11 — rest already in the pantry)
```

## 10. Theme — "snack arcade"

A cartoon 2D game (Overcooked-ish), tasty first. Tailwind tokens only; no hex
literal in a component. The game look is applied in app/globals.css by selectors
on classes components already carry, so a restyle stays one file.

```
           light                      dark ("arcade at night")
bg         #FFF1C9 custard            #1A1030 grape cabinet
surface    #FFFAF0 plate              #2B1D4D
line       #1D1033 ink outline        #07030F
fill       #FFE0A3 crust              #3D2A66   placeholders, skeletons, active rows
gold       #FFC61A                    same      HUD bar, title drop shadow, selection
ink        #1D1033                    same      text on gold
accent     #C0221A tomato             #FF6A55   primary CTA, ticks, focus rings
accent2    #7A2BC9 grape              #D39BFF   destructive, highlights, active filters
text       #1D1033                    #FFF4DC
muted      #5B4A6E                    #C9B8E6
sausage    #C0492B                    same      the announcer

display  Baloo 2 800 — round, chunky (Lilita One tried: no Polish capitals)
body     Nunito
mono     JetBrains Mono — quantities and units, so numbers align

all three loaded with subsets ['latin', 'latin-ext'] — Polish needs
ą ć ę ł ń ó ś ź ż, and a display face that falls back on ł is unusable

page     gingham tablecloth: two 7% tomato stripes over bg, 48px
header   gold HUD bar, 4px ink bottom edge
lines    2px outlines, 3px on cards
cards    hard 5px ink offset shadow (sticker); dashed = empty slot, flat
buttons  coloured: 2px ink border on a 4px ink lip, press drops onto the lip;
         outlined: 3px lip
h1       ink letters, hard 3px gold drop
radius   20px cards, 14px inputs
motion   cards pop in (scale .92, slight tilt, overshoot); linked cards hop and
         tilt on hover; buttons press; 160-220ms; all behind
         prefers-reduced-motion
```

type     18px root (html 112.5%) — every rem-based size scales with it;
         body Nunito 500; labels bold, full text colour, never muted
pixels   UI icons and food sprites are 12×12 pixel art (lib/pixel.ts);
         every Ingredient Line gets a sprite by Polish stem match
         (lib/ingredient-sprites.ts), a pot when nothing matches

Text colours clear WCAG AA in both modes, measured on every screen.

### Announcer — MC Kiełbas

The "?" in the header opens a game-dialogue box pinned to the bottom of the
screen: portrait, name plate, text typed out letter by letter, ▼ to advance
(click/Enter finishes the line, then moves on; Escape leaves). A smug sausage
in a bow tie doing fighting-game MC — cheeky innuendo, never explicit. One
script per screen in `copy.help.pages`, chosen by `lib/help.ts`. Every line
must stay true about what the screen does. Reduced motion: no typing, no bob.

## 11. Language and voice

**The interface is in Polish.** Every user-facing string, date, Tag label, validation
message, error and empty state. There is no language switcher and no second locale.

**Code stays in English.** Identifiers, table and column names, glossary terms, ADRs,
commit messages and Jira tickets. `ingredientLine.item` holds `"masło"`. Mixed-language
identifiers age badly and make the codebase unsearchable against its own docs.

**No i18n library.** One module, `lib/copy.ts`, exporting a flat keyed object of Polish
strings. `next-intl` and friends exist to serve a second locale; there isn't one. Every
user-facing string comes from that module — none inline in a component.

`<html lang="pl">`. Dates and numbers through `Intl` with `pl-PL`.

### Voice

Mild and cheeky. No swearing, no innuendo needing explanation. **Copy decorates, it
never replaces information** — an error still names the field and the reason. Polish
informal register throughout (*ty*, not *Pan/Pani*) — it's a household app, not a bank.

| Where | String |
|---|---|
| Login | Witaj ponownie. |
| Empty library | Brak przepisów. Dodaj pierwszy. |
| Add | Dodaj przepis |
| Import parked | Odłożone. Zajmiemy się tym, gdy kuchnia będzie otwarta. |
| Draft ready | Szkic gotowy — sprawdź go przed zapisaniem. |
| Import failed | Nie znaleziono przepisu na tej stronie. Spróbuj innego linku albo wpisz ręcznie. |
| Validation | Podaj nazwę przepisu. |
| Delete confirm | Usunąć „Ragu”? Tego nie da się cofnąć. |
| Deleted | Usunięto. **Cofnij** |
| No results | Brak wyników. Spróbuj innej frazy. |
| Wake lock on | Ekran nie zgaśnie podczas gotowania. |
| Pantry Check | Co już masz? |
| Export | Wyślij listę zakupów |
| Servings | Porcje |
| Cook log | Ugotowane! |

Polish typographic quotes („…") in copy, not straight quotes.

### Consequences of Polish

These are real work items, not notes:

- **Tag labels are Polish, Tag slugs stay English.** `slug: "breakfast"`,
  `label: "Śniadanie"`. The schema already separates them. Code and queries reference
  slugs; only `label` is ever rendered.
- **Search must ignore diacritics.** Someone typing `zurek` must find `żurek`, and
  `Śniadanie` must match `sniadanie`. This needs the `unaccent` extension and a
  functional trigram index over `unaccent(lower(title))` — not plain `pg_trgm`. Same for
  Ingredient Line item.
- **Polish sort order.** `ORDER BY label` needs `COLLATE "pl-PL-x-icu"`. Two traps: the
  bare name `"pl-PL"` does not exist on Neon and errors the query outright (ICU
  collations carry the `-x-icu` suffix), and this database's default collation is
  `C.UTF-8`, so omitting it sorts by byte value and dumps every diacritic after Z —
  `Świeże` lands last instead of after `Słodkie`.
- **The display font must carry Polish glyphs.** Anton and Archivo Black need the
  `latin-ext` subset for ąćęłńóśźż; verify they render before committing to either.
  A display face that silently falls back on ł is not usable.
- **The Worker writes Polish.** An English source page yields a Polish Recipe — the model
  translates as it structures. Ingredient items, Steps, Tips and Substitute notes all come
  back in Polish. The `title` keeps the dish's proper name where one exists
  (*Shakshuka*, *Ragù*), rather than being forcibly translated.
- **Polish plural rules.** "1 porcja / 2 porcje / 5 porcji" — three forms, not two.
  Use `Intl.PluralRules("pl-PL")`; naive `n === 1` logic is wrong in Polish.

## 12. Validation

| Field | Rule |
|---|---|
| title | 1–120 chars, trimmed, required |
| servings | integer 1–99, required |
| total_minutes | integer 1–10080, optional |
| kcal_per_serving | integer 0–10000, optional |
| tags | 0–5, must exist in the tag table |
| ingredient lines | ≥1; `item` required 1–80 chars; `quantity` ≥0 and optional; `unit` ≤20 |
| steps | ≥1, each 1–300 chars |
| tips | each ≤300 chars |
| image | jpg/png/webp, ≤5 MB pre-resize |
| source_url | valid http(s) URL, optional |
| invite token | single-use, unexpired, consumed atomically |

Same Zod schema in the form, the Server Action and the Worker. Client validation is a
convenience; the Server Action re-validates unconditionally.

All messages Polish, from `lib/copy.ts` — including the ones Zod would otherwise generate
in English. Character limits count Polish text, so bear in mind diacritics are single
characters, not two.

## 13. Non-functional

- **Every state designed:** empty, loading (skeletons, not spinners, where the shape is
  known), error, offline, partial data, permission-denied.
- **Optimistic where it's safe** — ticks, cook log, reroll — with rollback and a toast on
  failure.
- **Accessibility:** keyboard-operable throughout, visible focus rings in accent, labels
  on every input, error text tied to its field with `aria-describedby`, tick boxes as
  real checkboxes, dialogs focus-trapped, contrast checked against the near-black ground,
  motion respecting `prefers-reduced-motion`. Tap targets ≥44px — this is used with wet
  hands.
- **Performance:** recipe page server-rendered; images through `next/image` with sized
  Blob sources; autocomplete debounced ~150ms with in-flight requests aborted.
- **Secrets:** never in the client bundle. The Worker's credentials never leave the
  laptop.

## 14. Build phases

Each phase deploys and is usable. You could stop after 3 and still use this daily.

| # | Scope | Done when |
|---|---|---|
| 0 | Skeleton, Neon, Drizzle, Better Auth, invite + join, theme tokens, deployed | you can log in on the real URL, and a minted link creates a second account |
| 1 | Schema, manual CRUD, recipe page, editor, Blob upload, tag picker | you've typed in a real recipe and it survives a redeploy |
| 2 | Servings stepper, Pantry Check, wake lock, share export, cook log | you've cooked from your phone without the screen dying |
| 3 | Search: trgm, Facet filters, autocomplete, infinite scroll | a typo still finds the recipe |
| 4 | Worker: queue, JSON-LD parse, Claude Agent SDK, drafts, review mode, substitutes | a parked URL becomes a Recipe you approved |
| 5 | Dashboard widgets, Proposals, settings screen | the dashboard tells you something you didn't know |
| 6 | Polish pass: all states, validation, motion, a11y, mobile | nothing looks unfinished on a 375px screen |

## 15. Environment

**Production URL:** `https://openrecipe-michynows-projects.vercel.app`.
`openrecipe.vercel.app` was already taken by an unrelated app, so this longer host is the
canonical one — it's what `BETTER_AUTH_URL`, the Google redirect URIs and every Invite link
must use.

**Deployment Protection:** Vercel Authentication must be limited to preview deployments
only. With it covering production, invited Members hit Vercel's own SSO login and never
reach the app.

**App (Vercel):** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MASTER_EMAIL`, `BLOB_READ_WRITE_TOKEN`,
`GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY` (wakes the worker, ADR-0006).

**Worker (GitHub Actions secrets):** `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`,
`CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token` — the subscription, not an API
key). On the laptop the Claude CLI's own login stands in for the last one.

## 16. Deliberate omissions

Recorded so they're not mistaken for oversights: unit conversion, week planning,
ingredient-level nutrition, multi-language recipes, recipe versioning, comments,
ratings, print stylesheet, PWA install/offline, rate limiting (an invite-only app with
five users doesn't need it).

## 17. How we track the build (Jira)

Jira is the single source of truth for build state. Not this document, not a branch name,
not memory. If Jira and reality disagree, Jira is wrong and gets fixed immediately.

**Project:** `OpenRecipe` (`OR`) on simpleweb.atlassian.net. One Epic per build phase from
§14. Tasks hang off Epics. Subtasks only where a Task genuinely splits into steps that get
picked up separately.

### Ticket anatomy

Every Task carries these four sections, in this order, in the description. They exist so
an agent picking up the ticket cold needs nothing else:

```
## Goal
One sentence. The observable outcome, not the activity.
"A logged-in Member can tick ingredients and the ticks survive a reload."

## Done when
A checklist a stranger could verify without asking questions. Behaviour, not
implementation. No "works properly", no "looks good".
- [ ] Ticks persist across reload on the same day
- [ ] Ticks are gone the next calendar day
- [ ] Reordering ingredient lines does not move ticks

## Context
Files, tables, glossary terms, and the PRD/ADR sections that constrain this. Name the
Language terms from CONTEXT.md — a ticket saying "Pantry Check" is unambiguous;
one saying "checkbox state" is not.

## Out of scope
What NOT to touch. This is what stops a small ticket eating an afternoon.
```

### Status discipline

- **A ticket's status matches reality at all times.** Move it to In Progress when work
  starts — not after. Move it to Done when *Done when* is fully satisfied — not when the
  code is written.
- **One ticket In Progress at a time.** If something must pause, move it back and say why
  in a comment.
- **Blocked work gets a comment naming the blocker**, and moves back out of In Progress.
  A ticket sitting In Progress for days with no movement is a lie.
- **Partial completion is never Done.** Split the ticket instead: close what's finished,
  open a new one for the rest, and reference it.
- **Discoveries become tickets, not silent scope.** Found a real problem outside the
  current ticket? New ticket in the same Epic, linked. Never widen the one in hand.
- **A comment on completion** stating what actually shipped and anything that deviated
  from the plan. This is the audit trail when something turns out wrong two phases later.

### Epic closure

An Epic moves to Done **only when every child Task is Done** — no exceptions, no
"mostly". If a child is being dropped rather than built, it's explicitly closed as
won't-do with a reason, which is a decision worth being able to find later. Closing the
Epic is its own deliberate act: check the children, confirm the phase's "done when" from
§14 holds, then close.

### Glossary is binding

Ticket titles, descriptions, branch names, commit messages and code all use the terms in
[CONTEXT.md](./CONTEXT.md). Recipe, Draft, Worker, Pantry Check, Cook Log, Meal Slot.
Not "meal", not "job runner", not "checklist state". This is what makes tickets and code
searchable against each other.

## 18. Still open

- [ ] Recipe template for the Worker's output voice (you said "anything will do for now").
- [ ] Whether hand-typed Recipes should be enrichable by the Worker on demand
      (Substitutes and Tips for recipes that never came from a URL).

**Resolved 2026-07-27:** Proposal reroll persists as a per-user database counter (§7.3),
not a URL parameter. It follows you between devices and survives navigation.
