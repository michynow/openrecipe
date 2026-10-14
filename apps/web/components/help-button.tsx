"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { copy } from "@openrecipe/core/copy";
import { helpTopic } from "@openrecipe/core/help";

/** Milliseconds per typed character. Game dialogue speed, not reading speed. */
const TYPE_MS = 22;

/**
 * The "?" in the header. Opens MC Kiełbas in a game-style dialogue box pinned
 * to the bottom of the screen: portrait, name plate, text typed out letter by
 * letter, ▼ to advance. Click or Enter skips the typing, then moves on; Escape
 * leaves. Native <dialog> brings the focus trap and Escape for free.
 */
export function HelpButton({ className = "" }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const lines = copy.help.pages[helpTopic(usePathname())];

  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState(0);

  const text = lines[line] ?? "";
  const typing = open && typed < text.length;
  const last = line === lines.length - 1;

  useEffect(() => {
    if (!typing) return;
    // Reduced motion gets the whole line at once — no typewriter.
    const step = matchMedia("(prefers-reduced-motion: reduce)").matches ? text.length : 1;
    const timer = setInterval(() => setTyped((n) => Math.min(n + step, text.length)), TYPE_MS);
    return () => clearInterval(timer);
  }, [typing, text.length]);

  function start() {
    setLine(0);
    setTyped(0);
    setOpen(true);
    dialog.current?.showModal();
  }

  function advance() {
    if (typing) return setTyped(text.length);
    if (last) return dialog.current?.close();
    setLine(line + 1);
    setTyped(0);
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-label={copy.help.open}
        aria-haspopup="dialog"
        title={copy.help.open}
        className={`flex size-11 items-center justify-center rounded-full border border-line font-display text-2xl text-text ${className}`}
      >
        ?
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="mx-auto mt-auto mb-6 w-[calc(100%-2rem)] max-w-4xl overflow-visible bg-transparent p-0 text-text backdrop:bg-line/50"
      >
        <div
          onClick={advance}
          className="relative flex cursor-pointer gap-3 rounded-card border border-line bg-surface p-3 pt-6 sm:gap-4 sm:p-4 sm:pt-6"
        >
          <h2
            id={titleId}
            className="absolute -top-4 left-4 rounded-input border border-line bg-gold px-3 py-0.5 font-display text-lg uppercase text-ink"
          >
            {copy.help.name}
          </h2>

          <div className="size-20 shrink-0 overflow-hidden rounded-input border border-line bg-fill sm:size-24">
            <Kielbas talking={typing && typed % 6 < 3} />
          </div>

          <div className="flex min-h-20 flex-1 flex-col justify-between gap-2 sm:min-h-24">
            {/* Screen readers get the whole line at once; the typing is for eyes only. */}
            <p className="sr-only" aria-live="polite">
              {text}
            </p>
            <p aria-hidden="true" className="text-base leading-snug font-semibold sm:text-lg">
              {text.slice(0, typed)}
            </p>

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-muted">
                {line + 1}/{lines.length}
              </span>
              <button
                type="button"
                autoFocus
                onClick={(event) => {
                  event.stopPropagation();
                  advance();
                }}
                className="flex min-h-11 items-center gap-2 rounded-input bg-accent px-4 font-display text-sm uppercase text-accent-ink"
              >
                {last && !typing ? copy.help.close : copy.help.next}
                <span
                  aria-hidden="true"
                  className={typing ? "opacity-0" : "motion-safe:animate-[blink_0.9s_steps(1)_infinite]"}
                >
                  ▼
                </span>
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

/**
 * MC Kiełbas: a smug sausage with a pencil moustache, one raised eyebrow,
 * bedroom eyes and a grape bow tie. Bobs while idle, flaps his mouth while
 * talking. Colours are tokens.
 */
export function Kielbas({ talking }: { talking: boolean }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className="size-full stroke-line motion-safe:animate-[bob_1.6s_ease-in-out_infinite]"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="rotate(-6 48 52)">
        {/* twine */}
        <path fill="none" d="M48 12V5M43 3l5 3 5-3" />
        {/* body */}
        <rect className="fill-sausage" x="22" y="10" width="52" height="92" rx="26" />
        <path className="stroke-surface" fill="none" opacity=".45" d="M31 24q-5 18 0 36" />
        {/* grill marks */}
        <path fill="none" d="M28 66l7-5M28 75l7-5" />
        {/* eyes: half-lidded */}
        <circle className="fill-surface" cx="40" cy="38" r="6.5" />
        <circle className="fill-surface" cx="57" cy="38" r="6.5" />
        <circle className="fill-line stroke-none" cx="41" cy="40.5" r="2.4" />
        <circle className="fill-line stroke-none" cx="58" cy="40.5" r="2.4" />
        <path className="fill-sausage" d="M33.5 38a6.5 6.5 0 0 1 13 0z" />
        <path className="fill-sausage" d="M50.5 38a6.5 6.5 0 0 1 13 0z" />
        {/* brows: one level, one raised */}
        <path fill="none" d="M33 28l11 2" />
        <path fill="none" d="M51 27q6-6 12-1" />
        {/* pencil moustache */}
        <path className="fill-line" d="M37 52q5-4 11 0q6-4 11 0q-5 3-11 1q-6 2-11-1z" />
        {/* mouth */}
        {talking ? (
          <path className="fill-line" d="M41 57q8 10 15 0q-7 3-15 0z" />
        ) : (
          <path fill="none" d="M41 58q8 5 15-3" />
        )}
        {/* bow tie */}
        <path className="fill-accent2" d="M48 82L33 73v18zM48 82l15-9v18z" />
        <rect className="fill-accent2" x="44.5" y="78.5" width="7" height="7" rx="2" />
      </g>
    </svg>
  );
}
