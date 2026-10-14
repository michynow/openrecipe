import Form from "next/form";
import Link from "next/link";

import { copy } from "@openrecipe/core/copy";
import { formatDuration } from "@openrecipe/core/format";
import {
  searchHref,
  toggleTag,
  type SearchFilters,
} from "@openrecipe/core/search-params";
import type { FacetGroup } from "@/lib/tags-query";

/**
 * The search box and the Facet filter panel (OR-36).
 *
 * A Server Component with no client state of its own, because it does not need
 * any: every control is either a field in a GET form or a link, and both of those
 * write the URL, which is where the whole view already lives. That is also what
 * makes the back button correct for free — there is nothing of ours for it to
 * restore.
 *
 * `next/form` rather than a bare `<form>` so submitting is a client-side
 * navigation instead of a document load, and the results grid keeps its place in
 * the router cache. The one cosmetic cost is that a GET form posts its empty
 * fields too, so the URL after a submit can read `?q=&time=`; those parse back to
 * "not set", so the link still means exactly what it shows.
 *
 * Filters apply on submit rather than on every tick. One tap on "Pokaż wyniki" is
 * one navigation and one query, where live-applying five Tags would be five of
 * each — and on a phone the panel covers the results it would be updating anyway.
 */

/** The presets. Round numbers people actually plan around, not a slider. */
const TIME_PRESETS = [null, 15, 30, 60] as const;

export function SearchFilterPanel({
  filters,
  groups,
}: {
  filters: SearchFilters;
  groups: FacetGroup[];
}) {
  const labelFor = (slug: string) =>
    groups.flatMap((group) => group.tags).find((tag) => tag.slug === slug)
      ?.label ?? slug;

  const activeCount =
    filters.tagSlugs.length +
    (filters.maxTotalMinutes !== undefined ? 1 : 0) +
    (filters.hasImage ? 1 : 0);

  /** Chips carry the filters only; clearing them must not throw the query away. */
  const cleared: SearchFilters = {
    query: filters.query,
    tagSlugs: [],
    maxTotalMinutes: undefined,
    hasImage: false,
  };

  return (
    <Form action="/search" className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filters.query ?? ""}
          placeholder={copy.search.placeholder}
          aria-label={copy.nav.search}
          className="min-h-11 w-full rounded-input border border-line bg-surface px-3 text-base placeholder:text-muted"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-input bg-accent px-4 text-sm font-medium text-accent-ink"
        >
          {copy.nav.search}
        </button>
      </div>

      {/*
        Active filters stay visible whether or not the panel is open — a collapsed
        panel must never be the only place that says why a result set is short.
      */}
      {activeCount > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5">
          {filters.tagSlugs.map((slug) => (
            <li key={slug}>
              <Chip
                href={searchHref(toggleTag(filters, slug))}
                label={labelFor(slug)}
              />
            </li>
          ))}

          {filters.maxTotalMinutes !== undefined && (
            <li>
              <Chip
                href={searchHref({ ...filters, maxTotalMinutes: undefined })}
                label={`${copy.search.maxTime}: ${formatDuration(filters.maxTotalMinutes)}`}
              />
            </li>
          )}

          {filters.hasImage && (
            <li>
              <Chip
                href={searchHref({ ...filters, hasImage: false })}
                label={copy.search.hasImage}
              />
            </li>
          )}

          <li>
            <Link
              href={searchHref(cleared)}
              className="px-1.5 py-1 text-sm text-muted underline"
            >
              {copy.search.clearFilters}
            </Link>
          </li>
        </ul>
      )}

      {/*
        `<details>` is the whole mobile sheet: the platform owns the open state,
        the keyboard and the accessible name, and none of it costs a byte of JS.
        Closed by default at every width, because on a 375px screen an open panel
        of 45 Tags is the screen.
      */}
      <details className="group rounded-card border border-line bg-surface">
        <summary className="sticky top-0 z-10 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-card bg-surface px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
          {copy.search.filters}
          {activeCount > 0 && (
            <span className="rounded-input bg-accent px-1.5 font-mono text-sm text-accent-ink">
              {activeCount}
            </span>
          )}
          {/* The panel scrolls under a sticky summary, so the toggle stays in reach. */}
          <span aria-hidden className="ml-auto text-muted">
            <span className="group-open:hidden">▾</span>
            <span className="hidden group-open:inline">▴</span>
          </span>
        </summary>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto border-t border-line p-3 sm:max-h-none">
          {groups.map((group) => (
            <fieldset key={group.facet} className="flex min-w-0 flex-col gap-1.5">
              <legend className="text-sm font-extrabold uppercase tracking-wide text-text">
                {copy.editor.facets[group.facet] ?? group.facet}
              </legend>
              <ul className="flex flex-wrap gap-1.5">
                {group.tags.map((option) => (
                  <li key={option.slug}>
                    <Option
                      type="checkbox"
                      name="tag"
                      value={option.slug}
                      label={option.label}
                      checked={filters.tagSlugs.includes(option.slug)}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}

          <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="text-sm font-extrabold uppercase tracking-wide text-text">
              {copy.search.maxTime}
            </legend>
            <ul className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((minutes) => (
                <li key={minutes ?? "any"}>
                  <Option
                    type="radio"
                    name="time"
                    // The empty value is how "no limit" is chosen again once a
                    // limit has been set; it parses back to no filter at all.
                    value={minutes === null ? "" : String(minutes)}
                    label={
                      minutes === null
                        ? copy.search.anyTime
                        : formatDuration(minutes)!
                    }
                    checked={filters.maxTotalMinutes === (minutes ?? undefined)}
                  />
                </li>
              ))}
            </ul>
          </fieldset>

          <Option
            type="checkbox"
            name="img"
            value="1"
            label={copy.search.hasImage}
            checked={filters.hasImage}
          />

          <button
            type="submit"
            className="min-h-11 rounded-input bg-accent text-sm font-medium text-accent-ink"
          >
            {copy.search.apply}
          </button>
        </div>
      </details>
    </Form>
  );
}

/** One removable filter. A link, so removing it is an ordinary navigation. */
function Chip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`${copy.common.delete}: ${label}`}
      className="flex min-h-8 items-center gap-1 rounded-input bg-accent2 px-2 py-1 text-sm font-medium text-accent-ink"
    >
      {label} <span aria-hidden>×</span>
    </Link>
  );
}

/**
 * One filter option: a real checkbox or radio, named so the GET form encodes it
 * without any help. `defaultChecked` rather than `checked` — the URL sets the
 * initial state and the browser owns it from there, which is what makes this
 * component stay on the server.
 *
 * The explicit `aria-label` repeats the visible text on purpose: a wrapping label
 * left every one of these announcing itself as "on" (see tag-picker.tsx).
 */
function Option({
  type,
  name,
  value,
  label,
  checked,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label
      // :has(:checked), not the prop — these inputs are uncontrolled, so the
      // prop is only the state the page loaded with.
      className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-input border border-line px-2 py-1 text-sm font-bold text-text transition-colors hover:bg-fill has-checked:border-accent has-checked:bg-accent has-checked:font-extrabold has-checked:text-accent-ink"
    >
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={checked}
        aria-label={label}
        className="accent-accent"
      />
      {label}
    </label>
  );
}
