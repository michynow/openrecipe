import { del } from "@vercel/blob";

import { isOwnBlobUrl } from "@openrecipe/core/blob";

/**
 * Deleting blobs. Separate from lib/blob.ts because that module is imported by
 * the editor, and the Blob SDK has no business in a browser bundle.
 *
 * Best-effort: a failure here leaves an orphaned blob, which costs a few kilobytes
 * of a free allotment — not a reason to fail the save that called it, and not
 * something the user could act on if told.
 *
 * `isOwnBlobUrl` is the trust boundary. This is reachable from a Server Action,
 * so the URL is untrusted input, and a Recipe imported by the Worker carries a
 * `source_url` pointing at somebody else's site.
 */
export async function deleteBlob(url: string | null): Promise<void> {
  if (!isOwnBlobUrl(url)) return;
  try {
    await del(url!);
  } catch (error) {
    console.error("blob delete failed", url, error);
  }
}
