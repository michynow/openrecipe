"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  deleteRecipeAction,
  restoreRecipeAction,
} from "@/app/(app)/recipes/actions";
import { Icon } from "@/components/icons";
import { confirmDelete, copy } from "@/lib/copy";

/**
 * Delete a Recipe, with a confirm dialog and an undo (OR-25).
 *
 * Native `<dialog>` with `showModal()`, not a div. The element already traps focus,
 * already closes on Escape, already returns focus where it came from, and already
 * renders on the top layer above everything. A hand-rolled version of that is fifty
 * lines that get one of them subtly wrong.
 *
 * The dialog says the delete cannot be undone while an undo sits right behind it.
 * That tension is deliberate and specified: the sentence is what makes people stop
 * and read the title, and the undo is what saves the ones who did not.
 *
 * After a successful delete the reader stays put with the toast rather than being
 * thrown home immediately — you cannot offer an undo on a screen nobody is looking
 * at. The redirect happens when the window closes, because by then this page is a
 * 404 waiting to happen.
 */

/** How long the undo toast stays up before the page gives up and goes home. */
const UNDO_WINDOW_MS = 8_000;

export function DeleteRecipeDialog({
  recipeId,
  title,
}: {
  recipeId: string;
  title: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageId = useId();

  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleted, setDeleted] = useState(false);

  /**
   * Closing the dialog hands focus back to the trigger, which is about to
   * disappear. Move it onto the undo instead — that is the only live control left,
   * and a keyboard user who lands on nothing has lost the undo entirely.
   */
  useEffect(() => {
    if (deleted) undoButton.current?.focus();
  }, [deleted]);

  /** A pending redirect must not outlive the component that scheduled it. */
  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  async function remove() {
    setPending(true);
    setFailed(false);
    try {
      await deleteRecipeAction(recipeId);
      dialog.current?.close();
      setDeleted(true);
      leaveTimer.current = setTimeout(() => router.replace("/"), UNDO_WINDOW_MS);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  async function undo() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setPending(true);
    try {
      await restoreRecipeAction(recipeId);
      setDeleted(false);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {!deleted && (
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="inline-flex min-h-11 items-center gap-2 rounded-input border border-line px-3 text-sm font-extrabold text-accent2"
        >
          <Icon name="remove" className="size-5" />
          {copy.common.delete}
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={messageId}
        className="m-auto max-w-sm rounded-card border border-line bg-surface p-5 text-text backdrop:bg-bg/80"
      >
        <div className="flex flex-col gap-4">
          <p id={messageId} className="text-sm">
            {confirmDelete(title)}
          </p>

          {failed && (
            <p role="alert" className="text-sm text-accent2">
              {copy.common.somethingFailed}
            </p>
          )}

          <div className="flex items-center justify-end gap-4 text-sm">
            {/* method="dialog" closes the thing with no handler and no state. */}
            <form method="dialog">
              <button type="submit" className="text-muted underline">
                {copy.editor.cancel}
              </button>
            </form>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-input bg-accent2 px-3 py-1.5 font-medium text-accent-ink disabled:opacity-50"
            >
              {copy.common.delete}
            </button>
          </div>
        </div>
      </dialog>

      {deleted && (
        <p role="status" className="text-sm">
          {copy.common.deleted}{" "}
          <button
            ref={undoButton}
            type="button"
            onClick={undo}
            disabled={pending}
            className="text-accent underline disabled:opacity-50"
          >
            {copy.common.undo}
          </button>
        </p>
      )}
    </>
  );
}
