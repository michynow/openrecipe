import type { Api, ApiErrorCode, Endpoint, Iso } from "@openrecipe/core/api";
import type { ZodType } from "zod";

import type { CurrentUser } from "./session.ts";

/**
 * Helpers for the /api/v1 Route Handlers (ADR-0007). Handlers stay thin: guard,
 * parse, call the same lib function the Server Action calls, `ok(...)`.
 *
 * Nothing here imports Next at load time, so `node --test` can reach `fail` and
 * `jsonBody`. `guard` pulls in the session module lazily for the same reason.
 */

/**
 * The lib hands back `Date`s where the wire says `Iso`; JSON.stringify bridges
 * them. Only branded `Iso` fields widen — a plain string field still takes only
 * a string.
 */
export type Wire<T> = T extends Iso
  ? Date | string
  : T extends object
    ? { [K in keyof T]: Wire<T[K]> }
    : T;

/** `_e` is only there so each handler names its endpoint and the compiler checks the shape. */
export function ok<E extends Endpoint>(_e: E, data: Wire<Api[E]["res"]>): Response {
  return Response.json(data);
}

export function fail(
  status: 400 | 401 | 403 | 404,
  error: ApiErrorCode,
  issues?: unknown,
): Response {
  return Response.json(issues === undefined ? { error } : { error, issues }, { status });
}

/**
 * CSRF guard. Server Actions get an Origin check for free; Route Handlers do not.
 * A cross-site form cannot send JSON without a CORS preflight, which we never answer.
 */
export function requireJson(request: Request): Response | null {
  const type = request.headers.get("content-type") ?? "";
  return type.toLowerCase().startsWith("application/json")
    ? null
    : fail(400, "bad-request", "content-type must be application/json");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

/**
 * A uuid path parameter, or a 404. Postgres throws on a malformed uuid, which
 * would surface as a 500 with an HTML body; an id that cannot exist is simply
 * not found.
 */
export function uuid(value: string): string | Response {
  return isUuid(value) ? value : fail(404, "not-found");
}

/**
 * The request body, or null once it passes `max` bytes. Stops reading there
 * instead of buffering whatever a client chooses to send.
 */
export async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > max) return null;
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function jsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T | Response> {
  const refused = requireJson(request);
  if (refused) return refused;

  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  return parsed.success ? parsed.data : fail(400, "bad-request", parsed.error.issues);
}

/**
 * The session check. Pass `request` on a mutation to apply the JSON-only guard
 * (including bodyless ones: the phone sends the header anyway).
 */
export async function guard(
  kind: "user" | "admin",
  request?: Request,
): Promise<CurrentUser | Response> {
  if (request && request.method !== "GET") {
    const refused = requireJson(request);
    if (refused) return refused;
  }

  const { requireAdmin, requireUser } = await import("./session.ts");
  try {
    return await (kind === "admin" ? requireAdmin() : requireUser());
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.startsWith("Unauthorised")) return fail(401, "unauthorised");
    if (message.startsWith("Forbidden")) return fail(403, "forbidden");
    throw e;
  }
}
