import type { Api, ApiErrorCode, Endpoint } from "@openrecipe/core/api";
import { useQuery } from "@tanstack/react-query";

import { API_URL, getCookie } from "./auth";
import { signOut } from "./sign-out";
import { buildUrl } from "./url";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode | null;
  constructor(status: number, code: ApiErrorCode | null) {
    super(code ?? `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

export async function api<E extends Endpoint>(
  endpoint: E,
  opts: {
    params?: Record<string, string>;
    query?: Record<string, string | string[]>;
    body?: Api[E]["body"];
  } = {},
): Promise<Api[E]["res"]> {
  const { method, path } = buildUrl(endpoint, opts.params, opts.query);
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      // Always: the handlers reject mutations without it (CSRF guard).
      "Content-Type": "application/json",
      Cookie: getCookie(),
    },
    credentials: "omit",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: ApiErrorCode } | null;
    // Dead session: clearing it lets the layout gate send the user to /login.
    // No cookie left means we already signed out (a late reply from the
    // sign-out's own push-token delete): don't sign out a second time.
    if (res.status === 401 && getCookie() !== "") await signOut();
    throw new ApiError(res.status, json?.error ?? null);
  }
  return (await res.json()) as Api[E]["res"];
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api("GET /api/v1/me") });
}
