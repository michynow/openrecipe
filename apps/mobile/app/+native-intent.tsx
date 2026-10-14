/**
 * Android hands a shared page to the app as an `openrecipe://dataUrl=…` link.
 * It is not a route: expo-share-intent reads the payload natively, so send the
 * router home instead of to "not found" (see the library's expo-router example).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return path.includes("dataUrl=") ? "/" : path;
}
