import { get } from "@vercel/blob";

import { getCurrentUser } from "@/lib/session";

/**
 * Serves a Recipe image out of the private Blob store (OR-22).
 *
 * The store is private, so its URLs answer 401 to a browser. This route is the
 * one thing holding the store's token, and it checks for a session first — which
 * makes the images exactly as private as the rest of the app, rather than public
 * objects behind an unguessable name.
 *
 * `next/image` still does the optimising and caching in front of this, so a warm
 * image never reaches here at all.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pathname: string[] }> },
): Promise<Response> {
  if (!(await getCurrentUser())) {
    return new Response(null, { status: 401 });
  }

  const { pathname } = await params;
  const key = pathname.map(decodeURIComponent).join("/");

  const result = await get(key, { access: "private" });
  if (!result || result.statusCode !== 200) {
    return new Response(null, { status: 404 });
  }

  return new Response(result.stream, {
    headers: {
      "content-type": result.blob.contentType,
      "content-length": String(result.blob.size),
      /**
       * Uploads carry a random suffix, so a given path's bytes never change —
       * cache hard. `private` keeps it out of shared caches, since the object
       * itself is not public.
       */
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
