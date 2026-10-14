import { spawn } from "node:child_process";

import { copy } from "@openrecipe/core/copy";
import { appendLog } from "./draft-queue.ts";
import { cleanGithubToken, dispatchFailureHint } from "./github-token.ts";

/**
 * Wake the cloud kitchen: start the Worker in GitHub Actions right now instead
 * of waiting for its cron (ADR-0006).
 *
 * A `repository_dispatch` with a fine-grained token scoped to this repo
 * (Contents: write — what the dispatch API requires). Not configured (no
 * token) is a normal state — local dev, or a Master who prefers the laptop —
 * and the Draft's log says so. Never throws:
 * parking a link must not fail because GitHub had a bad minute; the cron is
 * the safety net.
 */
export async function wakeKitchen(draftId: string): Promise<void> {
  const token = cleanGithubToken(process.env.GITHUB_DISPATCH_TOKEN);
  // Vercel names the Git repository it deploys from, so the explicit variable
  // is only an override — forgetting it used to switch the cloud kitchen off.
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  const repo = process.env.GITHUB_REPOSITORY || (owner && slug ? `${owner}/${slug}` : undefined);

  if (!token || !repo) {
    if (process.env.NODE_ENV === "development") return wakeLocalKitchen(draftId);
    await appendLog(
      draftId,
      "warn",
      copy.imports.log.wakeOff(!token ? "GITHUB_DISPATCH_TOKEN" : "GITHUB_REPOSITORY"),
    );
    return;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: "draft-parked" }),
      signal: AbortSignal.timeout(10_000),
    });

    // 204 No Content is the only success GitHub sends for a dispatch.
    if (response.status === 204) {
      await appendLog(draftId, "info", copy.imports.log.woke);
    } else {
      const hint = dispatchFailureHint(response.status);
      await appendLog(
        draftId,
        "warn",
        copy.imports.log.wakeFailed(`GitHub HTTP ${response.status}${hint ? `: ${hint}` : ""}`),
      );
    }
  } catch (error) {
    await appendLog(draftId, "warn", copy.imports.log.wakeFailed((error as Error).message));
  }
}

/**
 * Local dev without a dispatch token: cook on this laptop instead (ADR-0002 —
 * the laptop always worked). Same script as `pnpm worker`; it drains the queue
 * and exits, and two at once are safe (claims skip locked rows), so one per
 * parked link is fine. Output goes to the `next dev` terminal.
 */
async function wakeLocalKitchen(draftId: string): Promise<void> {
  try {
    spawn(process.execPath, ["--env-file-if-exists=.env.local", "scripts/worker.ts"], {
      cwd: process.cwd(),
      stdio: "inherit",
    }).on("error", (error) => console.error("[kitchen] local worker failed:", error));
    await appendLog(draftId, "info", copy.imports.log.wokeLocal);
  } catch (error) {
    await appendLog(draftId, "warn", copy.imports.log.wakeFailed((error as Error).message));
  }
}
