"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";

import {
  discardDraftAction,
  retryDraftAction,
} from "@/app/(app)/drafts/actions";
import { copy } from "@openrecipe/core/copy";
import type { DraftRow } from "@/lib/draft-queue";
import { DRAFT_STAGES, type DraftLogEntry } from "@openrecipe/core/drafts";
import { formatClock, formatElapsed, formatRelativeDays } from "@openrecipe/core/format";

/** How often the list re-asks the server while something is moving. */
const REFRESH_MS = 2500;

/**
 * The Drafts screen's list (OR-45).
 *
 * While any Draft is queued or being worked on, the list refreshes itself, and
 * each of those Drafts shows a progress bar with the Worker's current step and
 * a running clock — so parking a link is something you can watch, not a black
 * box you come back to later.
 *
 * A failed Draft shows the Worker's own reason rather than a generic apology —
 * "page is not a recipe" and "fetch was blocked" want different next moves.
 */
export function DraftList({ drafts }: { drafts: DraftRow[] }) {
  const router = useRouter();
  const active = drafts.some((d) => d.status === "queued" || d.status === "processing");

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      // A background tab does not need fresh data; it gets it on return.
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  if (drafts.length === 0) {
    return <p className="text-base text-muted">{copy.imports.draftsEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {active && (
        <p role="status" className="flex items-center gap-2 self-end text-sm font-extrabold uppercase tracking-wide">
          <span className="size-3 rounded-full border-2 border-line bg-leaf motion-safe:animate-pulse" />
          {copy.imports.progress.live}
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {drafts.map((draft) => (
          <DraftItem key={draft.id} draft={draft} />
        ))}
      </ul>
    </div>
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
  const canRetry = draft.status === "failed" || draft.status === "ready" || draft.status === "limited";
  const canDiscard = draft.status !== "approved" && draft.status !== "discarded";
  const moving = draft.status === "queued" || draft.status === "processing";

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusChip status={draft.status} />
        <span className="font-mono text-sm text-muted">
          {formatRelativeDays(draft.createdAt)}
        </span>
      </div>

      {/*
        The link is the only thing identifying a Draft until the Worker has read
        it — there is no title yet. `break-all` because a recipe URL is long and
        must not push the card sideways on a phone.
      */}
      <p className="break-all text-base font-semibold">{draft.sourceUrl}</p>

      {moving && <Progress draft={draft} />}

      {draft.status === "limited" && (
        <p className="text-base font-semibold">
          {copy.imports.limitedHint(formatClock(draft.queuedAt))}
        </p>
      )}

      {draft.status === "failed" && (
        <p role="alert" className="text-base font-semibold text-accent2">
          {draft.error ?? copy.imports.failedFallback}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {draft.status === "ready" && (
          <Link
            href={`/drafts/${draft.id}`}
            className="flex min-h-11 items-center rounded-input bg-accent px-4 text-base text-accent-ink"
          >
            {copy.imports.review}
          </Link>
        )}

        {canRetry && (
          <button
            type="button"
            onClick={() => run(retryDraftAction)}
            disabled={pending}
            className="min-h-11 rounded-input border border-line px-3 text-sm font-bold text-text disabled:opacity-50"
          >
            {copy.imports.retry}
          </button>
        )}

        {draft.status === "failed" && (
          <Link
            /* Carries the link across, so typing it out by hand still keeps the
               provenance the import was going to record. */
            href={`/recipes/new?source=${encodeURIComponent(draft.sourceUrl)}`}
            className="flex min-h-11 items-center rounded-input border border-line px-3 text-sm font-bold text-text"
          >
            {copy.imports.typeInstead}
          </Link>
        )}

        {canDiscard && (
          <button
            type="button"
            onClick={() => run(discardDraftAction)}
            disabled={pending}
            className="min-h-11 rounded-input border border-line px-3 text-sm font-bold text-text hover:text-accent2 disabled:opacity-50"
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

      {draft.log.length > 0 && <DraftLog entries={draft.log} />}
    </li>
  );
}

/** A level's marker colour. Paired with the text, never instead of it. */
const LEVEL: Record<DraftLogEntry["level"], string> = {
  info: "bg-leaf",
  warn: "bg-gold",
  error: "bg-accent2",
};

/**
 * The Draft's log, collapsed by default with the latest line as its summary, so
 * "what is it doing" is visible at a glance and the full story is one tap away.
 */
function DraftLog({ entries }: { entries: DraftLogEntry[] }) {
  const latest = entries[entries.length - 1];
  return (
    <details className="group rounded-input border-2 border-line/30 bg-bg">
      <summary className="flex min-h-11 items-center gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block font-mono transition-transform group-open:rotate-90">▸</span>
        <span className="font-extrabold uppercase tracking-wide">
          {copy.imports.log.toggle} ({entries.length})
        </span>
        <span className="min-w-0 flex-1 truncate text-muted group-open:hidden">{latest.msg}</span>
      </summary>
      <ol className="flex flex-col gap-1.5 border-t-2 border-line/20 px-3 py-2">
        {entries.map((entry, index) => (
          <li key={index} className="flex items-baseline gap-2 text-sm">
            <span aria-hidden className={`size-2.5 shrink-0 translate-y-0.5 rounded-full border border-line ${LEVEL[entry.level]}`} />
            <time dateTime={entry.at} className="shrink-0 font-mono text-muted tabular-nums">
              {formatLogTime(entry.at)}
            </time>
            <span className="min-w-0 break-words">{linkify(entry.msg)}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * "12.10, 14:03:27" on the household's clock. The zone is pinned rather than
 * left to the runtime: the server renders in UTC, the phone in Warsaw, and the
 * two would disagree at hydration.
 */
const logTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const formatLogTime = (at: string) => logTime.format(new Date(at));

/** URLs in a log line become links — the source page, the Actions run. */
function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/** queued, then the Worker's own steps — one segment each. */
const STEPS = ["queued", ...DRAFT_STAGES] as const;

/**
 * A game-style loading bar: finished steps in green, the current one striped
 * and moving, the rest empty. Under it, which step and for how long.
 */
function Progress({ draft }: { draft: DraftRow }) {
  const current =
    draft.status === "queued" ? 0 : STEPS.indexOf(draft.stage ?? "fetching");
  const since = draft.status === "queued" ? draft.queuedAt : (draft.claimedAt ?? draft.queuedAt);
  const { steps, step, waiting, working, queuedHint } = copy.imports.progress;

  return (
    <div className="flex flex-col gap-2">
      <ol
        className="grid grid-cols-4 gap-1.5"
        aria-label={`${step} ${current + 1}/${STEPS.length}: ${steps[STEPS[current]]}`}
      >
        {STEPS.map((name, index) => (
          <li
            key={name}
            className={`h-5 rounded-full border-2 border-line ${
              index < current ? "bg-leaf" : index === current ? "bg-sky motion-safe:animate-[stripes_0.8s_linear_infinite]" : "bg-fill"
            }`}
            style={
              index === current
                ? {
                    backgroundImage:
                      "linear-gradient(45deg, rgb(255 255 255 / 0.45) 25%, transparent 25%, transparent 50%, rgb(255 255 255 / 0.45) 50%, rgb(255 255 255 / 0.45) 75%, transparent 75%)",
                    backgroundSize: "28px 28px",
                  }
                : undefined
            }
          />
        ))}
      </ol>
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-base">
        <span className="font-bold">
          {step} {current + 1}/{STEPS.length} · {steps[STEPS[current]]}…
        </span>
        <span className="font-mono text-sm text-muted">
          {draft.status === "queued" ? waiting : working} <Elapsed since={since} />
        </span>
      </p>
      {draft.status === "queued" && <p className="text-sm text-muted">{queuedHint}</p>}
    </div>
  );
}

/**
 * A ticking clock since `since`: m:ss for the first hour, then hours, then days
 * (a link parked while the kitchen was shut can wait a long time). Blank on the
 * server, so hydration never disagrees.
 */
function Elapsed({ since }: { since: Date }) {
  const now = useSyncExternalStore(subscribeToSeconds, nowSeconds, () => null);
  if (now === null) return null;
  const total = Math.max(0, now - Math.floor(since.getTime() / 1000));
  return <>{formatElapsed(total, copy.units.days)}</>;
}

function subscribeToSeconds(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Status as a word, never as a colour alone. The fill is reinforcement: green
 * "your turn", sky "the kitchen is on it", gold "waiting", grape "it broke".
 */
function StatusChip({ status }: { status: DraftRow["status"] }) {
  const tone: Record<DraftRow["status"], string> = {
    ready: "bg-leaf text-ink",
    processing: "bg-sky text-ink",
    queued: "bg-gold text-ink",
    limited: "bg-gold text-ink",
    failed: "bg-accent2 text-accent-ink",
    approved: "bg-fill text-text",
    discarded: "bg-fill text-muted",
  };

  return (
    <span className={`rounded-input border-2 border-line px-2.5 py-0.5 text-sm font-extrabold uppercase ${tone[status]}`}>
      {copy.imports.status[status]}
    </span>
  );
}
