import Link from "next/link";

import { copy } from "@/lib/copy";

const links = [
  { href: "/", label: copy.nav.dashboard },
  { href: "/search", label: copy.nav.search },
  { href: "/drafts", label: copy.nav.drafts },
] as const;

/**
 * The app shell's header. Lives in the root layout for now; the (auth) route
 * group will get its own layout without it once /login exists (OR-13, OR-16).
 *
 * The account slot is a placeholder until Better Auth lands (OR-11) — there is
 * no session to read yet.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      {/*
        Wraps to two rows below sm: wordmark and the add button share the top row,
        the nav takes a full-width row beneath. Everything fits on one row from sm
        up. Measured at 375px, where a single row overflowed by ~60px and pushed
        the add button off screen.
      */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:gap-x-6 sm:px-6">
        <Link
          href="/"
          className="order-1 font-display text-xl uppercase tracking-tight text-accent"
        >
          {copy.app.name}
        </Link>

        <Link
          href="/recipes/new"
          className="order-2 ml-auto rounded-input bg-accent px-3 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 sm:order-3"
        >
          {copy.nav.add}
        </Link>

        <nav className="order-3 -mx-3 flex w-full items-center gap-1 text-sm sm:order-2 sm:mx-0 sm:w-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-input px-3 py-2 text-muted transition-colors hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
