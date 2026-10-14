/** Pure: no React Native imports, so plain Node can load it (see url.test.ts). */
export function buildUrl(
  endpoint: string,
  params: Record<string, string> = {},
  query: Record<string, string | string[]> = {},
): { method: string; path: string } {
  const space = endpoint.indexOf(" ");
  const method = endpoint.slice(0, space);
  let path = endpoint
    .slice(space + 1)
    .replace(/:(\w+)/g, (_, name: string) => {
      const value = params[name];
      if (value === undefined) throw new Error(`Missing path param :${name}`);
      return encodeURIComponent(value);
    });

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
  }
  const s = qs.toString();
  if (s) path += `?${s}`;
  return { method, path };
}
