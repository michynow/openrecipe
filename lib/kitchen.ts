import { copy } from "./copy.ts";
import { appendLog } from "./draft-queue.ts";

/**
 * Wake the cloud kitchen: start the Worker in GitHub Actions right now instead
 * of waiting for its cron (ADR-0006).
 *
 * A `repository_dispatch` with a fine-grained token that may only run this
 * repo's Actions. Not configured (no token) is a normal state — local dev, or a
 * Master who prefers the laptop — and the Draft's log says so. Never throws:
 * parking a link must not fail because GitHub had a bad minute; the cron is
 * the safety net.
 */
export async function wakeKitchen(draftId: string): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  // Vercel names the Git repository it deploys from, so the explicit variable
  // is only an override — forgetting it used to switch the cloud kitchen off.
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  const repo = process.env.GITHUB_REPOSITORY || (owner && slug ? `${owner}/${slug}` : undefined);

  if (!token || !repo) {
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
      await appendLog(draftId, "warn", copy.imports.log.wakeFailed(`GitHub HTTP ${response.status}`));
    }
  } catch (error) {
    await appendLog(draftId, "warn", copy.imports.log.wakeFailed((error as Error).message));
  }
}
