"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Kielbas } from "@/components/help-button";
import { copy } from "@openrecipe/core/copy";
import { finishedSince, type DraftPulse, type DraftStatus } from "@openrecipe/core/drafts";

/** Fired by anything that parks a Draft, so the poller starts watching at once. */
export const DRAFTS_CHANGED = "openrecipe:drafts-changed";

/** While the Worker has something: often enough that "done" feels immediate. */
const BUSY_MS = 4000;
/** Otherwise: just enough to notice a link parked from another device. */
const IDLE_MS = 30_000;
/** A toast nobody touches goes away on its own. */
const TOAST_MS = 3000;

/**
 * MC Kiełbas pops up when the Worker finishes a Draft, on whatever screen you
 * are on (lives in the header, which survives navigation).
 *
 * Polls /api/drafts/pulse and diffs against the last answer — see
 * `finishedSince` for why the first answer is only a baseline. Pauses in a
 * background tab and catches up the moment it is visible again.
 */
export function DraftToasts() {
  const router = useRouter();
  const [toasts, setToasts] = useState<DraftPulse[]>([]);
  const seen = useRef<Map<string, DraftStatus> | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function poll() {
      clearTimeout(timer);
      let busy = false;

      if (document.visibilityState === "visible") {
        try {
          const res = await fetch("/api/drafts/pulse", { cache: "no-store" });
          if (res.ok) {
            const { drafts } = (await res.json()) as { drafts: DraftPulse[] };
            if (seen.current) {
              const done = finishedSince(seen.current, drafts);
              if (done.length > 0) {
                setToasts((current) => [...current, ...done]);
                // Dashboard counters and the Drafts list are server-rendered.
                router.refresh();
              }
            }
            seen.current = new Map(drafts.map((d) => [d.id, d.status]));
            busy = drafts.some(
              (d) => d.status === "queued" || d.status === "processing" || d.status === "limited",
            );
          }
        } catch {
          // Offline or mid-deploy: try again next tick.
        }
      }

      if (!stopped) timer = setTimeout(poll, busy ? BUSY_MS : IDLE_MS);
    }

    const onVisible = () => document.visibilityState === "visible" && poll();

    poll();
    window.addEventListener(DRAFTS_CHANGED, poll);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener(DRAFTS_CHANGED, poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  // Stable, so a new toast arriving does not restart the others' timers.
  const dismiss = useCallback(
    (id: string) => setToasts((current) => current.filter((t) => t.id !== id)),
    [],
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-stretch gap-3 sm:bottom-4 sm:left-auto sm:top-auto sm:w-96"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: DraftPulse;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.id]);

  const ready = toast.status === "ready";

  return (
    <div
      role="status"
      className="pointer-events-auto relative flex gap-3 rounded-card border border-line bg-surface p-3 pt-5 text-text"
    >
      {/* Same name tag as the help dialogue: it is the same announcer. */}
      <span className="absolute -top-3.5 left-4 rounded-input border border-line bg-gold px-2 py-0.5 font-display text-sm uppercase text-ink">
        {copy.help.name}
      </span>

      <div className="size-14 shrink-0 overflow-hidden rounded-input border border-line bg-fill">
        <Kielbas talking={false} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p className="text-sm font-semibold leading-snug">
          {ready ? copy.imports.toastReady(toast.title) : copy.imports.toastFailed}
        </p>
        <Link
          href={ready ? `/drafts/${toast.id}` : "/drafts"}
          onClick={() => onDismiss(toast.id)}
          className="flex min-h-9 items-center rounded-input bg-accent px-3 text-sm text-accent-ink"
        >
          {ready ? copy.imports.review : copy.imports.toastOpenDrafts}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={copy.imports.toastDismiss}
        className="-mr-1 -mt-2 flex size-9 shrink-0 items-center justify-center rounded-input text-lg text-muted hover:text-text"
      >
        ✕
      </button>
    </div>
  );
}
