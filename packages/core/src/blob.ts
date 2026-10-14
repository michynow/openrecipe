/**
 * Vercel Blob housekeeping (OR-22).
 *
 * The store is PRIVATE (`Access: Private`, `*.private.blob.vercel-storage.com`),
 * so a stored URL is not fetchable by a browser — it answers 401. Two consequences
 * run through this module:
 *
 *   1. Reads go through /api/image, which fetches the blob with the store's token
 *      and requires a session. `imageSrc` builds that path.
 *   2. Deletes still take the canonical URL, and must be aimed at our own store —
 *      the delete path is reachable from a Server Action, so the URL is untrusted.
 *
 * The alternative was presigned URLs. Rejected: they expire, which means every
 * render path has to sign asynchronously and a URL cached in HTML goes stale.
 * `imageSrc` is pure and synchronous, so a client component can call it too —
 * which is also why nothing here imports the Blob SDK. Deleting lives in
 * lib/blob-server.ts, so the editor does not drag a server SDK into the browser.
 */

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

/** Whether a URL points at this instance's Blob store. */
export function isOwnBlobUrl(url: string | null): boolean {
  return blobPathname(url) !== null;
}

/**
 * The blob's path within the store, or null when the URL is not ours.
 *
 * Leading slash dropped, because that is the shape `get()` expects and the shape
 * the route's catch-all segment produces.
 */
export function blobPathname(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) return null;

    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    // A store URL with no object path addresses nothing.
    return pathname === "" ? null : pathname;
  } catch {
    return null;
  }
}

/**
 * What to hand `next/image` as `src`. Same-origin, so no remotePatterns entry and
 * no expiry. Anything that is not one of our blobs is passed through untouched —
 * a Worker-imported Recipe may still carry a foreign image URL.
 *
 * Images pointed at this path must be rendered with `unoptimized`. Next's image
 * optimizer fetches the source server-side and forwards no cookies, so /api/image
 * would answer it 401 and every picture would break — in production only, since
 * dev has the auth bypass. The optimizer buys little here anyway: uploads are
 * already resized to 1200px webp, around 10 kB.
 */
export function imageSrc(url: string | null): string | null {
  if (!url) return null;
  const pathname = blobPathname(url);
  if (!pathname) return url;

  return `/api/image/${pathname.split("/").map(encodeURIComponent).join("/")}`;
}

/** PRD §8 uses 1200w for the Worker's images; hand- and phone-uploaded ones match. */
export const MAX_IMAGE_WIDTH = 1200;
