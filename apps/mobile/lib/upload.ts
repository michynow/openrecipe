/** Pure: no React Native imports, so plain Node can load it (see upload.test.ts). */

/** The width to resize to, or null to leave the picture alone. Never upscales. */
export function fitWidth(width: number, max: number): number | null {
  return width > max ? max : null;
}

/**
 * Blobs uploaded in this editor session and not yet saved. Only those may be
 * deleted from the phone; an image the Recipe already had is dropped by the
 * server on save (the web's rule).
 */
export class SessionUploads {
  private urls = new Set<string>();

  add(url: string) {
    this.urls.add(url);
  }

  /** Everything still held, emptied: leaving without saving deletes these. */
  drain(): string[] {
    const all = [...this.urls];
    this.urls.clear();
    return all;
  }

  /** After a save: whatever is held now belongs to the Recipe and must survive. */
  clear() {
    this.urls.clear();
  }

  /** True once, when `url` was uploaded in this session: the caller should delete it. */
  take(url: string | null): boolean {
    return url !== null && this.urls.delete(url);
  }
}
