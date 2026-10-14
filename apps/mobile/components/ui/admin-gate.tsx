import { copy } from "@openrecipe/core/copy";

import { useMe } from "../../lib/api";
import { NotFound, StateView } from "./state-view";

export type AdminGate = { state: "pending" | "error" | "denied" | "ok"; ok: boolean; retry: () => void };

/**
 * Admin screens fail closed: only a loaded `isAdmin === true` opens them. While
 * /me loads it is a spinner, if it fails a retry, and anything else is "not
 * found" — as the web 404s rather than advertising the route. Pass `ok` to the
 * screen's queries as `enabled`, so nothing admin-only is fetched before that.
 */
export function useAdminGate(): AdminGate {
  const me = useMe();
  const state = me.data?.isAdmin === true ? "ok" : me.data ? "denied" : me.isError ? "error" : "pending";
  return { state, ok: state === "ok", retry: () => void me.refetch() };
}

/** What a gated screen renders instead of itself until the gate is `ok`. */
export function AdminGateView({ gate }: { gate: AdminGate }) {
  if (gate.state === "denied") return <NotFound />;
  if (gate.state === "error")
    return <StateView title={copy.common.somethingFailed} action={{ label: copy.common.retry, onPress: gate.retry }} />;
  return <StateView />;
}
