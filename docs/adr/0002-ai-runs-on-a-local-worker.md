# AI runs on a local worker, not on Vercel

> **Partly superseded by [ADR-0006](0006-worker-runs-in-github-actions.md):** the worker now runs in GitHub Actions. Everything about subscription-only inference below still holds.

All LLM work happens in a script on the owner's laptop, driven by their existing Claude
subscription through the Claude Agent SDK. The deployed Vercel app holds no model
credentials and makes no inference calls.

Why: the only way to use a Claude Pro/Max subscription programmatically is the `claude`
CLI binary (the Vercel AI SDK community provider for it wraps that binary). A Vercel
function has no such binary, a read-only filesystem, and no way to complete an OAuth
login — so subscription-backed inference is impossible there. The alternative was a
metered API key, which breaks the project's hard "free" constraint.

## Consequences

- **Imports are asynchronous.** The phone enqueues a URL; the laptop worker drains the
  queue and produces a Draft. A pasted link may sit for hours. This is the main cost.
- **Ingredient Substitutes are precomputed** at draft time and stored as data, so the
  phone can offer them with no model available. See the glossary entry.
- **Hand-typed Recipes get no AI enrichment** unless the worker is pointed at them
  deliberately.
- The worker connects to the same Neon database over its connection string. There is no
  private API between worker and app — the database *is* the interface.
- Reversible in one direction cheaply: adding a hosted API key later turns the queue into
  a real-time path without changing the schema.
