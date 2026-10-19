/** Pure parts of the update check, so node can test them. */

export const RELEASES_API = "https://api.github.com/repos/michynow/openrecipe/releases/latest";
/** Always the newest APK, whatever its version (mobile-release.yml). */
export const APK_URL = "https://github.com/michynow/openrecipe/releases/latest/download/openrecipe.apk";

/** "mobile-v1.2.3" or "1.2.3" to [1, 2, 3]; null for anything else. */
export function parseVersion(raw: string | null | undefined): number[] | null {
  const match = /^(?:mobile-v)?(\d+)\.(\d+)\.(\d+)$/.exec(raw?.trim() ?? "");
  return match ? match.slice(1).map(Number) : null;
}

/** Whether the release tag is a newer version than the installed one. Unknown on either side: no. */
export function isNewer(tag: string | null | undefined, installed: string | null | undefined): boolean {
  const a = parseVersion(tag);
  const b = parseVersion(installed);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
