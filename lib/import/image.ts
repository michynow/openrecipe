import { put } from "@vercel/blob";
import sharp from "sharp";

import { MAX_IMAGE_WIDTH } from "../image-resize.ts";

/**
 * The Worker's image pipeline (OR-43): take the photo the source page published,
 * make it ours, and stop depending on somebody else's server.
 *
 * The same 1200px webp target as a hand-upload (lib/image-resize.ts), by sharp
 * here rather than a canvas — same destination, same shape, different runtime.
 *
 * Hotlinking was the alternative and is why this exists: source sites
 * reorganise, block by Referer, and vanish, and a cookbook whose photos rot is
 * worse than one with no photos.
 */

/** Refuse a download that is obviously not a photo before decoding it. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const FETCH_TIMEOUT_MS = 20_000;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Resize to a 1200px-wide webp. Never enlarges: `withoutEnlargement` is what
 * keeps a small thumbnail from being blown up into a soft 1200px one.
 */
export async function toWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // honour EXIF orientation before resizing, or portraits come out sideways
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/** A filename for the store. The random suffix is added by Blob itself. */
export function blobNameFor(sourceUrl: string): string {
  let stem = "recipe";

  try {
    const last = new URL(sourceUrl).pathname.split("/").filter(Boolean).pop();
    if (last) stem = last.replace(/\.[^.]+$/, "").slice(0, 60);
  } catch {
    // A URL we cannot parse still deserves a name.
  }

  return `${stem || "recipe"}.webp`;
}

/**
 * Download, resize, store. Returns the Blob URL, or null when anything goes
 * wrong — a Draft without a photo is still a good Draft, and failing the whole
 * import because a CDN was slow would be absurd.
 */
export async function storeImageFromUrl(
  imageUrl: string,
  sourceUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").startsWith("image/")) {
      return null;
    }

    const source = Buffer.from(await response.arrayBuffer());
    if (source.byteLength === 0 || source.byteLength > MAX_SOURCE_BYTES) {
      return null;
    }

    const webp = await toWebp(source);

    const blob = await put(blobNameFor(sourceUrl), webp, {
      // The store is private; images are served through /api/image (OR-22).
      access: "private",
      contentType: "image/webp",
      addRandomSuffix: true,
    });

    return blob.url;
  } catch {
    return null;
  }
}
