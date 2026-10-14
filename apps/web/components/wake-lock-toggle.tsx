"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { copy } from "@/lib/copy";

/** Support never changes, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};

/**
 * Keeps the screen on while cooking, via the Screen Wake Lock API.
 *
 * Absent rather than broken where the API is missing (Safari before 16.4, any
 * non-secure context). The check runs through useSyncExternalStore because the
 * server has no `navigator`: the server snapshot is false, so the markup matches
 * and the toggle appears after hydration instead of tripping a mismatch.
 */
export default function WakeLockToggle() {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => "wakeLock" in navigator,
    () => false,
  );
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        // Unmounted or switched off while the request was in flight.
        if (cancelled) sentinel.release();
      } catch {
        // Refused (hidden tab, battery saver, policy). Fail quietly, but do not
        // leave the toggle claiming a lock that was never granted.
        setOn(false);
      }
    }
    acquire();

    /**
     * The browser silently releases the lock whenever the tab hides and never
     * gives it back. Without this, a toggle left on stops working the moment
     * someone checks a message — still lit, no longer holding anything.
     */
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      // Covers unmount and navigation away; a no-op if the browser got there first.
      sentinel?.release();
    };
  }, [on]);

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-input border border-line px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="accent-accent"
        />
        {copy.recipe.wakeLock}
      </label>
      {on && (
        <p role="status" className="text-sm text-muted">
          {copy.recipe.wakeLockOn}
        </p>
      )}
    </div>
  );
}
