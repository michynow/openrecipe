import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirect anonymous visitors to /login.
 *
 * This is an OPTIMISTIC check and nothing more: `getSessionCookie` only looks at
 * whether a session cookie is present, it does not validate it. Middleware runs on
 * every request, so hitting the database here would put a query in front of every
 * navigation — and a forged cookie would still get nowhere, because the pages and
 * Server Actions behind this all re-check the real session themselves
 * (`getCurrentUser`, `requireUser`, `requireMaster`).
 *
 * Treat this as a redirect for convenience, never as authorisation.
 */
const PUBLIC_PREFIXES = ["/login", "/join"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  /**
   * Localhost signs itself in — see devMaster() in lib/session.ts, which is the
   * other half of this and carries the same NODE_ENV guard. Without this skip the
   * redirect would fire first and the bypass below it would never be reached.
   */
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (getSessionCookie(request)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  // Preserve where they were going, so signing in does not dump them on the
  // dashboard having forgotten the recipe they opened.
  const intended = pathname + search;
  if (intended !== "/") login.searchParams.set("next", intended);

  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Everything except Better Auth's own endpoints (which must stay reachable to
   * sign in at all), Next internals, and static files.
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
