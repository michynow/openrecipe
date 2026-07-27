import Link from "next/link";

import { copy } from "@/lib/copy";

/**
 * Polish 404. Next's default is English, which would be the only untranslated
 * screen in the app — and it is reachable, since Master-only routes deliberately
 * render notFound() for a Member rather than a 403 (which would confirm the route
 * exists).
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="font-display text-4xl uppercase tracking-tight">
        {copy.common.notFoundTitle}
      </h1>
      <p className="text-sm text-muted">{copy.common.notFoundBody}</p>
      <Link href="/" className="mt-2 text-sm text-accent underline">
        {copy.common.backHome}
      </Link>
    </main>
  );
}
