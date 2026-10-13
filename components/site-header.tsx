import Link from "next/link";

import { HelpButton } from "@/components/help-button";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { SignOutButton } from "@/components/sign-out-button";
import { copy } from "@/lib/copy";
import { getCurrentUser } from "@/lib/session";

/**
 * The app shell's header. Lives in the root layout for now; the (auth) route
 * group will get its own layout without it once /login exists (OR-13, OR-16).
 *
 * Members are read-only, so they get no add button, Drafts or Settings — the
 * routes 404 for them anyway. Hiding is cosmetic; the actions check for real.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const isAdmin = user?.isAdmin ?? false;

  const links = [
    // No "Start" link: the wordmark already goes home.
    { href: "/search", label: copy.nav.search },
    ...(isAdmin
      ? [
          { href: "/drafts", label: copy.nav.drafts },
          { href: "/settings", label: copy.nav.settings },
        ]
      : []),
    { href: "/account", label: copy.nav.account },
  ];

  return (
    <header className="border-b-4 border-line bg-gold text-ink">
      {/*
        Wraps to two rows below sm: wordmark and the add button share the top row,
        the nav takes a full-width row beneath. Everything fits on one row from sm
        up. Measured at 375px, where a single row overflowed by ~60px and pushed
        the add button off screen.
      */}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:gap-x-6 sm:px-6">
        <Link
          href="/"
          className="order-1 font-display text-2xl uppercase tracking-tight text-ink [text-shadow:2px_2px_0_var(--color-accent)]"
        >
          {copy.app.name}
        </Link>

        {/* Pushes itself and the add button right on the narrow layout. */}
        <HelpButton className="order-2 ml-auto sm:order-4 sm:ml-0" />

        {isAdmin && (
          <Link
            href="/recipes/new"
            className="order-2 rounded-input bg-accent px-3 py-2 text-sm font-medium text-accent-ink sm:order-4"
          >
            {copy.nav.add}
          </Link>
        )}

        {/*
          Its own full-width row below sm — a search box narrow enough to share a
          row with the nav is too narrow to read a suggestion in. From sm up the
          ml-auto moves here, so search and the add button sit together on the
          right and the nav stays next to the wordmark.
        */}
        <div className="order-4 w-full sm:order-3 sm:ml-auto sm:w-56">
          <SearchAutocomplete />
        </div>

        <nav className="order-3 -mx-3 flex w-full flex-wrap items-center gap-1 text-sm sm:order-2 sm:mx-0 sm:w-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-input px-3 py-2 font-bold text-ink underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
          <SignOutButton className="ml-auto rounded-input px-3 py-2 font-bold text-ink underline-offset-4 hover:underline disabled:opacity-50 sm:ml-0" />
        </nav>
      </div>
    </header>
  );
}
