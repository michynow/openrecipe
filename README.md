# OpenRecipe

Private, invite-only recipe library for one household. Cooked from a phone, maintained
from a laptop.

- **[PRD.md](./PRD.md)** — what we're building and why
- **[CONTEXT.md](./CONTEXT.md)** — glossary. Use these words in code, commits and tickets.
- **[docs/adr/](./docs/adr/)** — decisions, with the reasoning that would otherwise be lost

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Neon Postgres + Drizzle ·
Better Auth · Vercel Blob. A separate laptop-side Worker does all LLM work —
see [ADR-0002](./docs/adr/0002-ai-runs-on-a-local-worker.md).

## Local

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Fill in `apps/web/.env.local` — each variable says which ticket needs it.

## Database

Schema is TypeScript in [`apps/web/lib/db/schema.ts`](./apps/web/lib/db/schema.ts); migrations are generated
SQL files under `apps/web/drizzle/`, committed and reviewed like any other code.

```bash
pnpm db:generate
```

Diffs the schema and writes a new migration. Works offline — no `DATABASE_URL` needed.

```bash
pnpm db:migrate
```

Applies pending migrations to whatever `DATABASE_URL` points at.

`drizzle-kit push` is deliberately not wired up: it mutates the database without leaving a
migration behind, and drift you cannot read in a diff is drift you cannot reason about six
months later.

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`.

## Conventions

**Tests.** `node:test` with Node's native type stripping — no framework, no transpile.
`pnpm test` runs every workspace's tests: `apps/web/lib/**/*.test.ts` and
`packages/core/src/**/*.test.ts`.

**Relative imports inside `lib/` and `packages/core` carry the `.ts` extension** (`./copy.ts`). Node strips
types but does no extension resolution, so anything reachable from a test must be imported
that way. Turbopack and `tsc` both accept it (`allowImportingTsExtensions`). App code
imports through the `@/` alias without an extension, as usual; shared code through
`@openrecipe/core/<module>` (also without one).

**Layout.** pnpm workspace: `apps/web` (Next.js, Vercel Root Directory), `apps/mobile`
(Expo, [ADR-0007](./docs/adr/0007-native-android-app.md)), `packages/core` (pure TS both
share — no DB, no Node built-ins, no Next).

**No user-facing string in a component.** Everything readable comes from
[`packages/core/src/copy.ts`](./packages/core/src/copy.ts); formatting from
[`packages/core/src/format.ts`](./packages/core/src/format.ts).

**No hex colour in a component.** Palette tokens live in
[`apps/web/app/globals.css`](./apps/web/app/globals.css).

## CI

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every push to `main`
and every PR: install (frozen lockfile), lint, typecheck, build.

## First run on an empty database

Accounts only exist via an Invite, and minting one needs a signed-in Master — circular
when nobody exists yet. This opens that door once:

```bash
MASTER_PASSWORD='choose-something' pnpm bootstrap-master
```

It reads `MASTER_EMAIL` from the environment, refuses to overwrite an existing account, and
takes the password from the environment rather than an argument so it stays out of `ps` and
your shell history. Then sign in and mint Invites from `/settings`.

## The Worker

Imports run on the laptop, never on Vercel ([ADR-0002](docs/adr/0002-ai-runs-on-a-local-worker.md)).
Park a link at `/drafts`, then drain the queue here:

```bash
pnpm worker
```

It needs `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`, both already in `.env.local`. It touches the `draft` table only: claims one queued row at a time with a
conditional `UPDATE … for update skip locked`, so two Workers running at once never take the
same row, and reclaims anything left in `processing` for more than ten minutes by a laptop
that got closed. With an empty queue it prints `nothing to do` and exits, so running it on a
whim costs nothing.

What it does per Draft: fetch the page, read its JSON-LD if it publishes any, otherwise keep
the readable text, hand either to Claude through the Agent SDK — which uses the CLI's own
subscription, so there is no API key here or on Vercel — and store the result as `ready` for
review. The model runs on both paths: a JSON-LD page still arrives in the wrong language,
with no Tags and no Substitutes. If it fails on a structured page, the Draft is still saved
from the page's own data, untranslated, rather than thrown away.
Every failure ends with the row moved to `failed` and a Polish reason on it — never a row
stranded in `processing`.

Worth knowing: **most Polish recipe sites publish no `@type: Recipe` structured data.**
Kwestia Smaku and Ania Gotuje both fall to the readable-text path, so the model call (OR-42)
is what makes them work, not a nicety on top.

## Where the build is

Phases 0 to 5 from PRD §14 are built. What that means in practice: sign in, type a
Recipe or park a link, let `pnpm worker` turn it into a Draft, review what the model
guessed, approve it, cook from your phone, search with typos, and see what the household
has been cooking.

Phase 6 — the polish pass over states, accessibility, motion and 375px — is deliberately
still open, and so is the wider UI rework that supersedes part of it.

Two things still need a person rather than a commit: linking the repo to Vercel so
production deploys on push (OR-8), and finishing the Better Auth Google setup against the
production URL (OR-11).

## Deploys

Deploys are owned by **Vercel's Git integration**, not by CI — so there are no
deploy tokens in this repo and preview deploys come free on every PR.

One-time setup: Vercel → Add New → Project → import `michynow/openrecipe`. Framework
detects as Next.js. Then add the environment variables listed in PRD §15.

Push to `main` → production. Open a PR → preview URL on the PR.

## Working agreement

Build order and the Jira tracking rules live in PRD §14 and §17. Short version: one
ticket in progress at a time, its status always reflects reality, and an Epic closes only
when every child is genuinely done.
