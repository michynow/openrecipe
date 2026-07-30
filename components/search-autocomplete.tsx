"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import type { RecipeCardData } from "@/components/recipe-card";
import { copy } from "@/lib/copy";

/**
 * The header's search box with suggestions (OR-37).
 *
 * An ARIA combobox, hand-rolled rather than pulled from a library: the whole
 * widget is an input, a list and four key handlers, which is less code than
 * configuring somebody else's.
 *
 * Focus never leaves the input. That is not a detail — `aria-activedescendant` is
 * how a combobox points at the highlighted option while the caret stays put, so
 * typing and highlighting work at the same time. Moving real focus into the list
 * would break both the typing and the announcement.
 */

/** PRD §13. Long enough to skip the keystrokes nobody meant to search on. */
const DEBOUNCE_MS = 150;

/**
 * One character is not a search: trigram matching scores it as noise, and the
 * dropdown would open on the way to every real query.
 */
const MIN_QUERY_LENGTH = 2;

/** Small on purpose — a dropdown must not pull eight full-size photos. */
const THUMBNAIL_PX = 48;

export function SearchAutocomplete() {
  const router = useRouter();
  const listId = useId();

  const [query, setQuery] = useState("");
  /**
   * `null` is "nothing has come back for this query yet", which is a different
   * thing from a search that returned nothing — one shows no dropdown at all, the
   * other shows the no-results line.
   */
  const [suggestions, setSuggestions] = useState<RecipeCardData[] | null>(null);
  const [open, setOpen] = useState(false);
  /** -1 means the input itself is active, so Enter must not open anything. */
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const trimmed = query.trim();
    // Nothing is cleared on the way down to an empty box: the panel is gated on
    // the same length below, so clearing here would only be a second way to say
    // it — and a setState in an effect body to say it with.
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    /**
     * Debounce and abort are one mechanism here, not two. React runs this cleanup
     * on every keystroke, so it cancels a request that has not left yet *and*
     * aborts one already in flight; only the fetch that survives to the end ever
     * reaches `setSuggestions`.
     *
     * That is what stops an older, slower response landing on top of a newer one
     * and making the list appear to go backwards while someone is still typing —
     * the usual reason an autocomplete feels broken.
     */
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setSuggestions(data.recipes ?? []);
        // Indexes just changed underneath the highlight, so it cannot survive.
        setActive(-1);
      } catch {
        /**
         * An abort arrives here as a rejection and is the ordinary case, not a
         * failure — so nothing is cleared, and the previous suggestions stay up
         * until the newer ones land rather than blinking out in between.
         *
         * A genuine network failure is silent for the same reason: the header's
         * search box is not where we tell someone their connection dropped.
         */
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items = suggestions ?? [];
  const showPanel =
    open && suggestions !== null && query.trim().length >= MIN_QUERY_LENGTH;
  /** Expanded describes the *listbox*, so an empty result is not "expanded". */
  const expanded = showPanel && items.length > 0;

  function openRecipe(recipe: RecipeCardData) {
    setOpen(false);
    router.push(`/recipes/${recipe.slug}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!expanded) return;

    // Both arrows wrap, and both must preventDefault or the caret jumps to the
    // far end of the input on its way through the list.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      // From -1 this lands on the last row, which is what up from nowhere means.
      setActive((index) => (index <= 0 ? items.length : index) - 1);
      return;
    }

    if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      openRecipe(items[active]);
    }
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Options cancel their own mousedown, so a blur here really is someone
        // leaving — tabbing away or clicking elsewhere — and the list should go.
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={
          active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-autocomplete="list"
        // The placeholder doubles as the label: it is a question, and there is no
        // room in the header for a visible one above the field.
        aria-label={copy.search.placeholder}
        placeholder={copy.search.placeholder}
        className="w-full rounded-input border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted"
      />

      {/*
        Always mounted, and only ever *styled* into view. A live region that
        appears with its text already in it is unreliably announced — the change
        has to happen to a region the screen reader is already watching. Empty and
        visually hidden the rest of the time, so nothing floats there.
      */}
      <p
        role="status"
        className={
          showPanel && !expanded
            ? "absolute inset-x-0 top-full z-20 mt-1 rounded-card border border-line bg-surface px-3 py-2 text-sm text-muted"
            : "sr-only"
        }
      >
        {showPanel && !expanded ? copy.search.noResults : ""}
      </p>

      {expanded && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card border border-line bg-surface">
          <ul id={listId} role="listbox" aria-label={copy.search.placeholder}>
            {items.map((recipe, index) => (
              <li
                key={recipe.slug}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                /**
                 * Swallowing mousedown is what keeps the input focused through a
                 * click: without it the blur fires first, the list unmounts, and
                 * the click lands on nothing.
                 */
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => openRecipe(recipe)}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                  index === active ? "bg-line" : ""
                }`}
              >
                {recipe.imageUrl ? (
                  <Image
                    src={recipe.imageUrl}
                    // Empty: the title sits beside it and is the row's name
                    // already, so alt text here would announce it twice.
                    alt=""
                    width={THUMBNAIL_PX}
                    height={THUMBNAIL_PX}
                    sizes={`${THUMBNAIL_PX}px`}
                    className="h-12 w-12 shrink-0 rounded-input object-cover"
                  />
                ) : (
                  /**
                   * The house placeholder at thumbnail size — first two letters
                   * on a flat ground, same as the Recipe page and the card. It
                   * holds the row's height, so a Recipe with no photo does not
                   * make the list jump as results change.
                   */
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-line font-display text-sm uppercase text-muted/40"
                  >
                    {recipe.title.slice(0, 2)}
                  </span>
                )}

                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-sm uppercase tracking-tight">
                    {recipe.title}
                  </span>
                  {/* Joined rather than chips: a suggestion row must never wrap
                      to a second line, and five Tags as chips would. */}
                  {recipe.tagLabels.length > 0 && (
                    <span className="truncate text-xs text-muted">
                      {recipe.tagLabels.join(" · ")}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
