import { put } from "@vercel/blob";

import { IMAGE_RULES, sniffImageType } from "@openrecipe/core/recipe-schema";
import { fail, guard, ok, readCapped } from "@/lib/api";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Upload a Recipe image from the phone (ADR-0007). The body is the raw image,
 * already resized on the device; the server puts it in the private Blob store.
 *
 * Not the web's client-upload flow (/api/blob/upload): that is a browser-side
 * protocol of @vercel/blob/client, and a resized photo is far under the
 * function body limit, so one plain request is simpler.
 *
 * CSRF: no JSON here, but an image content type is not a "simple" request, so a
 * cross-site form cannot send one without a CORS preflight we never answer.
 * Like the editor's uploads, nothing is written to the database until the
 * Recipe is saved; an abandoned one goes through POST /api/v1/images/delete.
 */
export async function POST(request: Request) {
  const user = await guard("admin");
  if (user instanceof Response) return user;

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!(IMAGE_RULES.mimeTypes as readonly string[]).includes(type)) {
    return fail(400, "bad-request", "content-type must be image/jpeg, image/png or image/webp");
  }

  const bytes = await readCapped(request, IMAGE_RULES.maxBytes);
  if (!bytes || bytes.byteLength === 0) {
    return fail(400, "bad-request", "image is empty or too large");
  }
  // The bytes must be what the header says: no HTML or script behind image/webp.
  if (sniffImageType(bytes) !== type) {
    return fail(400, "bad-request", "image content does not match its content-type");
  }

  const blob = await put(`recipe.${EXT[type]}`, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
    access: "private",
    contentType: type,
    addRandomSuffix: true,
  });

  return ok("POST /api/v1/images", { url: blob.url });
}
