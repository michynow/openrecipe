import { imageSrc } from "@openrecipe/core/blob";

export type ImageSource = { uri: string; headers?: { Cookie: string } };

/**
 * Pure (no React Native imports, so `node --test` loads it). Our blobs come back
 * from `imageSrc` as `/api/image/…`, which checks the session: those, and only
 * those, get the API origin and the cookie. A foreign http(s) image is passed
 * through with no headers — the cookie must never leave our API. Anything else
 * (`//host`, other schemes, no API_URL configured) renders as no image.
 */
export function imageSource(url: string | null, apiUrl: string, cookie: string): ImageSource | null {
  const src = imageSrc(url);
  if (!src) return null;
  if (src.startsWith("/api/image/")) {
    return apiUrl ? { uri: `${apiUrl}${src}`, headers: { Cookie: cookie } } : null;
  }
  return /^https?:\/\//i.test(src) ? { uri: src } : null;
}
