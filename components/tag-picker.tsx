"use client";

import { useState } from "react";

import { copy } from "@/lib/copy";
import { MAX_TAGS } from "@/lib/recipe-schema";
import type { FacetGroup } from "@/lib/tags-query";

/**
 * Pick up to 5 Tags, grouped by Facet.
 *
 * Native checkboxes rather than styled divs: they arrive keyboard-operable, they
 * announce their own checked state, and space-to-toggle is free. A custom widget
 * here would be more code and worse.
 *
 * The options come from the database (see lib/tags-query.ts), so Tags the Master
 * adds later appear with no code change.
 */
export function TagPicker({
  groups,
  selected,
  onChange,
  error,
}: {
  groups: FacetGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  /**
   * Shown when someone tries to exceed the cap. Not a validation error — nothing is
   * wrong with the Recipe — so it is transient and explains what to do instead of
   * the click appearing to do nothing.
   */
  const [capHit, setCapHit] = useState(false);

  const labelFor = (slug: string) =>
    groups.flatMap((g) => g.tags).find((t) => t.slug === slug)?.label ?? slug;

  function toggle(slug: string) {
    if (selected.includes(slug)) {
      setCapHit(false);
      onChange(selected.filter((s) => s !== slug));
      return;
    }
    if (selected.length >= MAX_TAGS) {
      setCapHit(true);
      return;
    }
    setCapHit(false);
    onChange([...selected, slug]);
  }

  const full = selected.length >= MAX_TAGS;

  return (
    <>
      {/* Chosen Tags, removable here without hunting through the groups. */}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => toggle(slug)}
                className="rounded-input bg-accent px-2 py-1 text-sm font-extrabold text-accent-ink"
                aria-label={`${copy.common.delete}: ${labelFor(slug)}`}
              >
                {labelFor(slug)} ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((group, index) => (
          <div
            key={group.facet}
            /* Hairline between Facets, so the five clusters separate from each other. */
            className={`flex flex-col gap-1.5 ${index > 0 ? "border-t border-line/40 pt-3" : ""}`}
          >
            <p className="text-sm font-extrabold uppercase tracking-wide text-text">
              {copy.editor.facets[group.facet] ?? group.facet}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {group.tags.map((option) => {
                const isSelected = selected.includes(option.slug);
                return (
                  <li key={option.slug}>
                    <label
                      className={`flex cursor-pointer items-center gap-1.5 rounded-input border px-2 py-1 text-sm transition-colors ${
                        isSelected
                          ? "border-accent bg-accent font-extrabold text-accent-ink"
                          : full
                            ? "cursor-not-allowed border-dashed border-line font-bold text-muted"
                            : "border-line font-bold text-text hover:bg-fill"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(option.slug)}
                        /**
                         * Explicit name. A wrapping label ought to name the input,
                         * but the computed accessible name came out as "on" for
                         * every one of them — 45 checkboxes announced identically
                         * is useless. aria-label removes the doubt.
                         */
                        aria-label={option.label}
                        className="accent-accent"
                      />
                      {option.label}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {capHit && (
        <p role="status" className="text-sm text-accent2">
          {copy.editor.tagsFull}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-accent2">
          {error}
        </p>
      )}
    </>
  );
}
