# The worker runs in GitHub Actions, woken by the app

Supersedes the "laptop" part of ADR-0002. The rest of it stands: the deployed
Vercel app still holds no model credentials and makes no inference calls, and
the model is still the Master's Claude subscription, not a metered API key.

The same `pnpm worker` runs in `.github/workflows/worker.yml`, authenticated
with a long-lived subscription token from `claude setup-token` stored as the
`CLAUDE_CODE_OAUTH_TOKEN` repository secret. The Agent SDK ships the Linux
`claude` binary as an optional dependency, so `pnpm install` is the whole setup.

Three triggers:

- **repository_dispatch** — the app calls GitHub's dispatch API right after a
  link is parked, retried or re-imported (`lib/kitchen.ts`, run in `after()`
  so the form never waits on GitHub). A Draft is usually ready in about a
  minute, most of it runner start-up and the model.
- **schedule**, every 30 minutes — the safety net for a lost wake-up.
- **workflow_dispatch** — a button, for "now".

`concurrency: worker` keeps it to one run at a time; a wake-up that lands
mid-run queues behind it instead of being dropped.

Why: imports used to wait until the laptop was open and someone ran the
worker by hand. Links sat for two months. The alternatives were a metered API
key on Vercel (instant, but paid per import and against the £0 constraint) or
keeping the laptop.

## Consequences

- **Still £0.** A run is one to two minutes; GitHub's free Actions minutes cover
  a household's imports many times over.
- **Secrets live in two places.** GitHub: `CLAUDE_CODE_OAUTH_TOKEN`,
  `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`. Vercel: `GITHUB_DISPATCH_TOKEN`
  (fine-grained, this repo only, Actions: read and write). The repository
  comes from Vercel's own `VERCEL_GIT_REPO_OWNER`/`_SLUG`; `GITHUB_REPOSITORY`
  only overrides it. Without the token, the Draft's log says so and the
  30-minute cron picks it up.
- **The subscription token expires** (about a year). When it does, model calls
  fail, the worker falls back to page data where it can, and the Draft's log
  carries the SDK's error. Regenerate with `claude setup-token`.
- **Scheduled workflows pause** after 60 days without repository activity.
  The dispatch trigger is unaffected; re-enable the schedule in the Actions tab.
- **The laptop still works.** `pnpm worker` locally is the same code and claims
  safely alongside a cloud run.
- Every step writes to the Draft's log (`draft.log`), shown on the Drafts
  screen, and a cloud run's log links to its Actions run.
