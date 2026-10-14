/**
 * Ingredient Sections (ADR-0008): an optional heading on each Ingredient Line.
 *
 * The invariant every stored Recipe holds: ungrouped lines first, then each
 * Section's lines together, Sections in the order they first appear. The Recipe
 * schema applies `normalizeSections` on parse, so readers can group consecutive
 * runs and never meet the same heading twice.
 *
 * Generic over the line shape so the editor's form lines, the read shape and the
 * export all use the same helpers. Pure; Hermes-safe.
 */

type Sectioned = { section?: string | null };

/** Trimmed and space-collapsed, or null for nothing at all. */
export const cleanSection = (value: string | null | undefined): string | null =>
  value?.trim().replace(/\s+/g, " ") || null;

const sectionOf = (line: Sectioned) => cleanSection(line.section);

/** Ungrouped first, then each Section together, first-appearance order. Stable. */
export function normalizeSections<T extends Sectioned>(lines: readonly T[]): T[] {
  const order: (string | null)[] = [null];
  for (const line of lines) {
    const section = sectionOf(line);
    if (!order.includes(section)) order.push(section);
  }
  return order.flatMap((section) =>
    lines
      .filter((line) => sectionOf(line) === section)
      .map((line) => (line.section === section ? line : { ...line, section })),
  );
}

export type SectionGroup<T> = {
  /** null: the ungrouped lines, shown with no heading. */
  section: string | null;
  /** `index` is the line's place in the flat list — the editor's error keys use it. */
  items: { line: T; index: number }[];
};

/** Consecutive runs of the same Section, for display. */
export function groupSections<T extends Sectioned>(lines: readonly T[]): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  lines.forEach((line, index) => {
    const section = sectionOf(line);
    const last = groups.at(-1);
    if (last && last.section === section) last.items.push({ line, index });
    else groups.push({ section, items: [{ line, index }] });
  });
  return groups;
}

/** Whether any line has a Section — when none does, render the plain list. */
export const hasSections = (lines: readonly Sectioned[]) => lines.some((line) => sectionOf(line) !== null);

/** The Sections in display order, without the ungrouped run. */
export const sectionNames = (lines: readonly Sectioned[]) =>
  groupSections(lines).flatMap((group) => (group.section === null ? [] : [group.section]));

/**
 * Reorder by splice (take out at `from`, put back at `to`). The moved line takes
 * the Section of the line it just passed, so dragging or arrowing across a
 * heading changes the Section and every position stays reachable.
 */
export function moveLine<T extends Sectioned>(lines: readonly T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= lines.length || from < 0 || from >= lines.length) {
    return [...lines];
  }
  const next = [...lines];
  const [line] = next.splice(from, 1);
  next.splice(to, 0, line);
  const passed = next[to < from ? to + 1 : to - 1];
  next[to] = { ...line, section: sectionOf(passed) };
  return next;
}

/** Put one line into a Section (null: ungroup it). It joins the end of that group. */
export function setLineSection<T extends Sectioned>(
  lines: readonly T[],
  index: number,
  section: string | null,
): T[] {
  const target = cleanSection(section);
  // Taken out and appended, so normalising leaves it last in its new group.
  const line = { ...lines[index], section: target };
  return normalizeSections([...lines.slice(0, index), ...lines.slice(index + 1), line]);
}

/** Rename a Section. Renaming onto an existing name merges the two; to empty ungroups. */
export function renameSection<T extends Sectioned>(
  lines: readonly T[],
  from: string,
  to: string | null,
): T[] {
  const target = cleanSection(to);
  return normalizeSections(
    lines.map((line) => (sectionOf(line) === from ? { ...line, section: target } : line)),
  );
}

/** Remove a Section heading. Its lines stay, ungrouped. */
export const removeSection = <T extends Sectioned>(lines: readonly T[], name: string): T[] =>
  renameSection(lines, name, null);

/** Start a Section: a blank line carrying it, at the end of the list. */
export function addSection<T extends Sectioned>(lines: readonly T[], name: string, blank: T): T[] {
  return normalizeSections([...lines, { ...blank, section: cleanSection(name) }]);
}
