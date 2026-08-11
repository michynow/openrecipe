"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { useRef, useState } from "react";

import { deleteImageAction } from "@/app/(app)/recipes/actions";
import { imageSrc } from "@/lib/blob";
import { copy } from "@/lib/copy";
import { resizeToWebp, webpName } from "@/lib/image-resize";
import { checkImage } from "@/lib/recipe-schema";

/**
 * The Recipe's photo (OR-22).
 *
 * Uploads go from the browser straight to Blob, with the server only minting a
 * scoped token (app/api/blob/upload/route.ts). That is what makes progress and
 * cancel real rather than a spinner over a Server Action.
 *
 * The field holds a URL, not a file: by the time the form is submitted the image
 * is already stored, so saving a Recipe is one small write regardless of the
 * photo's size.
 */
export function ImageField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  /**
   * URLs uploaded during this editing session and not yet saved to any Recipe.
   * Only these are safe to delete on the spot — an image the Recipe already
   * carries stays until the save that replaces it commits (lib/recipes.ts).
   */
  const unsaved = useRef(new Set<string>());

  function discardIfUnsaved(url: string | null) {
    if (url && unsaved.current.delete(url)) void deleteImageAction(url);
  }

  async function handleFile(file: File) {
    // The 5 MB and format rules apply to what came off the camera roll, before
    // resizing — same check the Server Action and the Worker use.
    const problem = checkImage(file);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);

    try {
      const body = await resizeToWebp(file);
      const blob = await upload(webpName(file.name), body, {
        // The store is private; a public upload into it is rejected outright.
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        contentType: body.type || "image/webp",
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      discardIfUnsaved(value);
      unsaved.current.add(blob.url);
      onChange(blob.url);
    } catch {
      // A cancel lands here too, and is not a failure worth shouting about.
      if (!controller.signal.aborted) setError(copy.editor.imageFailed);
    } finally {
      setProgress(null);
      abort.current = null;
      // Clearing the input lets the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    discardIfUnsaved(value);
    onChange(null);
    setError(null);
  }

  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-1.5">
      {/*
        The section header names this field visually; the label stays in the DOM
        because it is the file input's only programmatic name.
      */}
      <label htmlFor="imageUrl" className="sr-only">
        {copy.editor.image}
      </label>

      {value ? (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-card">
            <Image
              src={imageSrc(value)!}
              alt=""
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-input border border-line px-3 py-2 text-sm transition-colors hover:text-accent disabled:opacity-50"
            >
              {copy.editor.replaceImage}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-input border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-accent2 disabled:opacity-50"
            >
              {copy.editor.removeImage}
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          className={`flex aspect-4/3 w-full flex-col items-center justify-center gap-3 rounded-card border border-dashed px-4 text-center ${
            dragging ? "border-accent bg-surface" : "border-line"
          }`}
        >
          <p className="text-sm text-muted">{copy.editor.dropImage}</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-input border border-line px-3 py-2 text-sm transition-colors hover:text-accent disabled:opacity-50"
          >
            {copy.editor.pickImage}
          </button>
          <p className="text-xs text-muted opacity-60">{copy.editor.imageHint}</p>
        </div>
      )}

      {/*
        Hidden rather than absent: the buttons above drive it, but it stays a real
        file input, so the phone's own picker and camera roll are what open.
      */}
      <input
        ref={inputRef}
        id="imageUrl"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {busy && (
        <div className="flex items-center gap-3">
          <progress
            value={progress ?? 0}
            max={100}
            aria-label={copy.editor.uploading}
            className="h-1 flex-1"
          />
          <span className="font-mono text-xs text-muted">
            {Math.round(progress ?? 0)}%
          </span>
          <button
            type="button"
            onClick={() => abort.current?.abort()}
            className="text-sm text-muted underline transition-colors hover:text-accent2"
          >
            {copy.editor.cancelUpload}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-accent2">
          {error}
        </p>
      )}
    </div>
  );
}
