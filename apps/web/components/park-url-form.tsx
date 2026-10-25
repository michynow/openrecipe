"use client";

import Link from "next/link";
import { useState } from "react";

import { parkTextAction, parkUrlAction } from "@/app/(app)/drafts/actions";
import { DRAFTS_CHANGED } from "@/components/draft-toasts";
import { Icon } from "@/components/icons";
import { copy } from "@openrecipe/core/copy";

/**
 * Park a link for the Worker (OR-39).
 *
 * Deliberately the shortest possible form: one field, one button. This is the
 * thing being used one-handed on a phone while looking at somebody else's
 * recipe page, so anything more than paste-and-tap is friction in the wrong
 * place. Everything else about the Recipe is decided later, in review.
 */
export function ParkUrlForm() {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [existingSlug, setExistingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setNote(null);
    setExistingSlug(null);

    const result = await parkUrlAction(url);

    if (result.ok) {
      // Neither re-parking nor re-importing is an error. Say which of the three
      // happened and leave the queue alone.
      if ("existingSlug" in result) {
        setNote(copy.imports.alreadyImported);
        setExistingSlug(result.existingSlug);
      } else {
        setNote(
          result.alreadyQueued ? copy.imports.alreadyParked : copy.imports.parked,
        );
      }
      setUrl("");
      // Wake the header's toast poller: it watches this Draft from now on.
      window.dispatchEvent(new Event(DRAFTS_CHANGED));
    } else {
      setError(result.error);
    }

    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} noValidate className="flex flex-col gap-2">
        <p className="text-base">{copy.imports.parkIntro}</p>

        {/* The section header already says this; the label is here for the input. */}
        <label htmlFor="sourceUrl" className="sr-only">
          {copy.imports.parkTitle}
        </label>

        <div className="flex flex-wrap gap-2">
          <input
            id="sourceUrl"
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "sourceUrl-error" : undefined}
            className="min-w-0 flex-1 basis-full rounded-input border border-line bg-bg px-3 py-2 sm:basis-0"
          />
          <button
            type="submit"
            disabled={pending || url.trim() === ""}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-input bg-accent px-4 sm:w-auto py-2 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon name="link" className="size-4" />
            {copy.imports.parkAction}
          </button>
        </div>

        <p className="text-sm text-muted">{copy.imports.parkHint}</p>

        {note && (
          /* Not accent: next to the error line below it, coral read as "it failed". */
          <p role="status" className="flex items-start gap-2 text-sm font-semibold text-text">
            {/* Centred on the first line of text, not the whole block. */}
            <span aria-hidden className="mt-[0.45em] size-2.5 shrink-0 rounded-full border border-line bg-leaf" />
            <span>
              {note}{" "}
              {existingSlug && (
                <Link href={`/recipes/${existingSlug}`} className="underline underline-offset-4">
                  {copy.imports.openExisting}
                </Link>
              )}
            </span>
          </p>
        )}

        {error && (
          <p id="sourceUrl-error" role="alert" className="text-sm text-accent2">
            {error}
          </p>
        )}
      </form>
      <ParkTextForm />
    </div>
  );
}

/**
 * The recipe's own text instead of a link — for the ones no page holds
 * (an Instagram caption, a message). Folded away: the link is the usual case.
 */
function ParkTextForm() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setNote(null);

    const result = await parkTextAction(text);
    if (result.ok) {
      setNote(copy.imports.parked);
      setText("");
      window.dispatchEvent(new Event(DRAFTS_CHANGED));
    } else {
      setError(result.error);
    }

    setPending(false);
  }

  return (
    <details>
      <summary className="cursor-pointer text-sm font-bold underline underline-offset-4">
        {copy.imports.pasteToggle}
      </summary>
      <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-2">
        <label htmlFor="sourceText" className="sr-only">
          {copy.imports.pasteLabel}
        </label>
        <textarea
          id="sourceText"
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={copy.imports.pastePlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "sourceText-error" : undefined}
          className="rounded-input border border-line bg-bg px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending || text.trim() === ""}
          className="flex min-h-11 w-full items-center justify-center rounded-input bg-accent px-4 py-2 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto sm:self-start"
        >
          {copy.imports.pasteAction}
        </button>
        {note && (
          <p role="status" className="text-sm font-semibold text-text">
            {note}
          </p>
        )}
        {error && (
          <p id="sourceText-error" role="alert" className="text-sm text-accent2">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
