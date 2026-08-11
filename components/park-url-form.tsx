"use client";

import Link from "next/link";
import { useState } from "react";

import { parkUrlAction } from "@/app/(app)/drafts/actions";
import { Icon } from "@/components/icons";
import { copy } from "@/lib/copy";

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
    } else {
      setError(result.error);
    }

    setPending(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
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
          className="min-w-0 flex-1 rounded-input border border-line bg-bg px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending || url.trim() === ""}
          className="flex min-h-11 items-center gap-2 rounded-input bg-accent px-4 py-2 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Icon name="link" className="size-4" />
          {copy.imports.parkAction}
        </button>
      </div>

      <p className="text-xs text-muted">{copy.imports.parkHint}</p>

      {note && (
        <p role="status" className="text-sm text-accent">
          {note}{" "}
          {existingSlug && (
            <Link
              href={`/recipes/${existingSlug}`}
              className="underline underline-offset-4"
            >
              {copy.imports.openExisting}
            </Link>
          )}
        </p>
      )}

      {error && (
        <p id="sourceUrl-error" role="alert" className="text-sm text-accent2">
          {error}
        </p>
      )}
    </form>
  );
}
