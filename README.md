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
cp .env.example .env.local
pnpm dev
```

Fill in `.env.local` — each variable says which ticket needs it.

## Database

Schema is TypeScript in [`lib/db/schema.ts`](./lib/db/schema.ts); migrations are generated
SQL files under `drizzle/`, committed and reviewed like any other code.

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
`pnpm test` runs `lib/**/*.test.ts`.

**Relative imports inside `lib/` carry the `.ts` extension** (`./copy.ts`). Node strips
types but does no extension resolution, so anything reachable from a test must be imported
that way. Turbopack and `tsc` both accept it (`allowImportingTsExtensions`). App code
imports through the `@/` alias without an extension, as usual.

**No user-facing string in a component.** Everything readable comes from
[`lib/copy.ts`](./lib/copy.ts); formatting from [`lib/format.ts`](./lib/format.ts).

**No hex colour in a component.** Palette tokens live in
[`app/globals.css`](./app/globals.css).

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
