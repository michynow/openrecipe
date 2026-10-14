import { Icon, type IconName } from "@/components/icons";

/**
 * One section of the editor: a card with a numbered, icon-led header.
 *
 * The editor used to be one flat stack where the gap between the title and the
 * servings row was the same as the gap between Ingredients and Tags — which is
 * what made it read as a wall. Three things fix that here: a card boundary, a
 * mono numeral spine down the left so the eye can track position while
 * scrolling, and an icon to pattern-match against instead of having to read.
 *
 * `<fieldset>`/`<legend>` rather than a div and a heading: these are groups of
 * related controls, and the legend is what names the group to a screen reader.
 * The legend floats so the browser stops notching it into the card's top border.
 */
export function SectionCard({
  number,
  icon,
  label,
  trailing,
  children,
}: {
  /** Position in the spine, e.g. "01". Decorative — screen readers skip it. */
  number: string;
  icon: IconName;
  label: string;
  /** Optional right-aligned slot, e.g. the Tag counter. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    /*
      min-w-0 is load-bearing: a fieldset's default min-inline-size is min-content,
      so a row of inputs plus three 44px buttons pushed the Steps card 72px wider
      than its siblings and out past the form. Nothing else in the app hits this,
      because nothing else puts a wide flex row inside a fieldset.
    */
    <fieldset className="min-w-0 rounded-card border border-line bg-surface p-4">
      <legend className="float-left mb-3 flex w-full items-center gap-2 border-b border-line pb-2">
        <span aria-hidden className="font-mono text-base font-bold text-accent">
          {number}
        </span>
        <Icon name={icon} className="size-7 text-text" />
        <span className="font-display text-xl uppercase tracking-wide">
          {label}
        </span>
        {trailing && <span className="ml-auto">{trailing}</span>}
      </legend>

      <div className="clear-both flex flex-col gap-3">{children}</div>
    </fieldset>
  );
}

/**
 * A row-action button: reorder or remove, at a real 44px tap target.
 *
 * These were bare "↑ ↓ ×" characters in a 32px box — under the minimum in
 * PRD §13, and typographic glyphs read as text rather than as controls. The
 * label stays on the button, so the icon inside is decoration.
 */
export function RowButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-input transition-colors disabled:opacity-30 ${
        destructive ? "text-muted hover:text-accent2" : "text-muted hover:text-accent"
      }`}
    >
      <Icon name={icon} />
    </button>
  );
}

/**
 * The drag grip on a sortable row. Spread `useSortable().handleProps(...)` onto
 * it. 44px like every row action; `touch-none` so dragging it on a phone moves
 * the row instead of scrolling the page.
 */
export function GripButton({
  label,
  active,
  ...handle
}: { label: string; active: boolean } & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...handle}
      className={`flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-input active:cursor-grabbing ${
        active ? "bg-gold text-ink" : "text-muted hover:text-text"
      }`}
    >
      <Icon name="grip" className="size-6" />
    </button>
  );
}
