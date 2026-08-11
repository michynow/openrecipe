/**
 * The whole icon set. One file, hand-drawn paths, no dependency.
 *
 * A library would be 40 kB and a hundred glyphs to reach the ten used here. The
 * rules that keep a hand-rolled set coherent: 24×24 box, 1.5 stroke, no fill,
 * round caps and joins. Anything added later follows them or it will read as a
 * different set — there is no library backstopping consistency.
 *
 * Icons never carry meaning alone. Section icons sit next to their Polish label,
 * row-action icons sit inside a button that already has an aria-label, so every
 * one of them is aria-hidden and nothing is lost when they are not rendered.
 */

const PATHS = {
  /* Section identities */
  basics: "M4 5h16v14H4z M8 10h8 M8 14h5",
  ingredients: "M3 11h18a9 9 0 0 1-18 0Z M12 8V6 M8.5 8.5 7.5 7 M15.5 8.5 16.5 7",
  tags: "M11 3H3v8l10 10 8-8L11 3Z M7 7h.01",
  image: "M4 5h16v14H4z M4 16l4.5-4.5 3 3L15 11l5 5 M15.5 8.5h.01",
  steps: "M4 6h.01 M4 12h.01 M4 18h.01 M8 6h12 M8 12h12 M8 18h12",
  tips: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z",

  /** A parked Source URL, on the button that queues one. */
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1 M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",

  /* Row actions */
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  remove: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "size-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
