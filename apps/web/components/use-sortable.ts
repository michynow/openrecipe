"use client";

import { useRef, useState } from "react";

/**
 * Drag-to-reorder for a list of rows, via a grip handle on each row.
 *
 * Pointer events rather than HTML5 drag-and-drop: the native API does nothing on
 * touch screens, and these editors get used on a phone. The row moves live as
 * the pointer crosses its neighbours, so the list itself is the drop preview.
 *
 * The handle is also a keyboard control — ArrowUp / ArrowDown move the row and
 * keep focus on its handle — because drag-only reordering locks out anyone not
 * using a mouse or a finger.
 *
 * Rows must be the list's direct <li> children; `move` is a splice (take the
 * row out at `from`, put it back at `to`).
 */
export function useSortable(move: (from: number, to: number) => void) {
  const list = useRef<HTMLOListElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const handles = () => list.current?.querySelectorAll<HTMLElement>("[data-sort-handle]") ?? [];

  function moveTo(from: number, to: number, refocus: boolean) {
    move(from, to);
    // The row's data moved, its DOM did not: put focus on the handle now under it.
    if (refocus) requestAnimationFrame(() => handles()[to]?.focus());
  }

  function handleProps(index: number, count: number) {
    return {
      "data-sort-handle": "",
      onPointerDown(event: React.PointerEvent<HTMLElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(index);
      },
      onPointerMove(event: React.PointerEvent<HTMLElement>) {
        if (dragging === null || !list.current) return;
        const rows = [...list.current.children] as HTMLElement[];
        const target = rows.findIndex((row) => {
          const box = row.getBoundingClientRect();
          return event.clientY >= box.top && event.clientY < box.bottom;
        });
        if (target === -1 || target === dragging) return;
        moveTo(dragging, target, false);
        setDragging(target);
      },
      onPointerUp: () => setDragging(null),
      onPointerCancel: () => setDragging(null),
      onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
        const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        const target = index + delta;
        if (delta === 0 || target < 0 || target >= count) return;
        event.preventDefault();
        moveTo(index, target, true);
      },
    };
  }

  return { list, dragging, handleProps };
}

/** Splice-move, for the editors' `move`. */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
