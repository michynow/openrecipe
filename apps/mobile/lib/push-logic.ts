const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Where a tapped notification goes: the Draft in its data, or nowhere. Internal routes only. */
export function draftRoute(data: unknown): string | null {
  const id = (data as { draftId?: unknown } | null | undefined)?.draftId;
  return isUuid(id) ? `/drafts/${id}` : null;
}

/** Post the token unless it is empty or already the one the server has. */
export const shouldRegister = (token: unknown, stored: string | null): token is string =>
  typeof token === "string" && token !== "" && token !== stored;
