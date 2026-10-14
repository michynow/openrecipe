/**
 * Client-side image resizing, so a 4 MB phone photo does not travel as one (OR-22).
 *
 * Canvas rather than a library: the browser already decodes, scales and encodes
 * images, and `sharp` cannot run here. The Worker resizes with sharp on the laptop
 * (Phase 4) — different entry point, same 1200px target.
 */

import { MAX_IMAGE_WIDTH } from "@openrecipe/core/blob";

export { MAX_IMAGE_WIDTH };

const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.85;

/**
 * Scale to fit `max` wide, keeping the aspect ratio. Never upscales — enlarging a
 * small image adds bytes and no detail.
 */
export function fitWidth(
  width: number,
  height: number,
  max: number = MAX_IMAGE_WIDTH,
): { width: number; height: number } {
  if (width <= max) return { width, height };
  return { width: max, height: Math.max(1, Math.round((height * max) / width)) };
}

/** The uploaded filename, always .webp because that is what we encode. */
export function webpName(original: string): string {
  const stem = original.replace(/\.[^./]+$/, "") || "image";
  return `${stem}.webp`;
}

/**
 * Resize to webp. Returns the original File untouched if anything in the canvas
 * path is unavailable or fails — an unresized upload is still a working upload,
 * and the 5 MB limit has already been enforced by then.
 */
export async function resizeToWebp(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWidth(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
