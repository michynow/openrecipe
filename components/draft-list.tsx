"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  discardDraftAction,
  retryDraftAction,
} from "@/app/(app)/drafts/actions";
import { copy } from "@/lib/copy";
import type { DraftRow } from "@/lib/draft-queue";
import { formatRelativeDays } from "@/lib/format";

/**
 * The Drafts screen's list (OR-45).
 *
 * A failed Draft shows the Worker's own reason rather than a generic apology —
 * "page is not a recipe" and "fetch was blocked" want different next moves from
 * the reader. When the Worker left no message, the fallback still says what to
 * do instead of typing an error code at somebody.
 */
export function DraftList({ drafts }: { drafts: DraftRow[] }) {
  if (drafts.length === 0) {
    return <p className="text-sm text-muted">{copy.imports.draftsEmpty}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {drafts.map((draft) => (
        <DraftItem key={draft.id} draft={draft} />
      ))}
    </ul>
  );
}

function DraftItem({ draft }: { draft: DraftRow }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const run = (action: (id: string) => Promise<{ ok: boolean }>) => {
    setFailed(false);
    startTransition(async () => {
      const result = await action(draft.id);
      if (!result.ok) setFailed(true);
    });
  };

  /** Only these ever wait on a human; the rest are the Worker's business. */
  const canRetry = draft.status === "failed" || draft.status === "ready";
  const canDiscard = draft.status !== "approved" && draft.status !== "discarded";

  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <StatusChip status={draft.status} />
        <span className="font-mono text-xs text-muted">
          {formatRelativeDays(draft.createdAt)}
        </span>
      </div>

      {/*
        The link is the only thing identifying a Draft until the Worker has read
        it — there is no title yet. `break-all` because a recipe URL is long and
        must not push the card sideways on a phone.
      */}
      <p className="break-all text-sm">{draft.sourceUrl}</p>

      {draft.status === "failed" && (
        <p role="alert" className="text-sm text-accent2">
          {draft.error ?? copy.imports.failedFallback}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/*
          The review link belongs here and is deliberately absent: OR-44 builds
          the screen it would point at, and a button that 404s is worse than no
          button. Nothing can reach `ready` before the Worker exists anyway.
        */}

        {canRetry && (
          <button
            type="button"
            onClick={() => run(retryDraftAction)}
            disabled={pending}
            className="min-h-11 rounded-input border border-line px-3 text-sm text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            {copy.imports.retry}
          </button>
        )}

        {draft.status === "failed" && (
          <Link
            /* Carries the link across, so typing it out by hand still keeps the
               provenance the import was going to record. */
            href={`/recipes/new?source=${encodeURIComponent(draft.sourceUrl)}`}
            className="flex min-h-11 items-center rounded-input border border-line px-3 text-sm text-muted transition-colors hover:text-text"
          >
            {copy.imports.typeInstead}
          </Link>
        )}

        {canDiscard && (
          <button
            type="button"
            onClick={() => run(discardDraftAction)}
            disabled={pending}
            className="min-h-11 rounded-input border border-line px-3 text-sm text-muted transition-colors hover:text-accent2 disabled:opacity-50"
          >
            {copy.imports.discard}
          </button>
        )}
      </div>

      {failed && (
        <p role="alert" className="text-sm text-accent2">
          {copy.common.somethingFailed}
        </p>
      )}
    </li>
  );
}

/**
 * Status as a word, never as a colour alone. The tint is reinforcement: acid
 * green for "your turn", magenta for "it went wrong", muted for "still ours".
 */
function StatusChip({ status }: { status: DraftRow["status"] }) {
  const tone =
    status === "ready"
      ? "border-accent text-accent"
      : status === "failed"
        ? "border-accent2 text-accent2"
        : "border-line text-muted";

  return (
    <span className={`rounded-input border px-2 py-0.5 text-xs ${tone}`}>
      {copy.imports.status[status]}
    </span>
  );
}
