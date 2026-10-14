import { authClient } from "./auth";
import { unregisterToken } from "./push";
import { persister, queryClient } from "./query-client";

let inflight: Promise<void> | null = null;

/**
 * The one way out. Drops this user's data before the next one signs in: the
 * in-memory cache (home, search, tags, recipes) and the persisted offline copy in
 * AsyncStorage, then the session itself. Each step is best-effort, so a dead
 * network still leaves the phone signed out locally.
 *
 * One sign-out at a time: a second call (the push-token delete can 401 and land
 * back here through api()) joins the one already running instead of starting over.
 */
export function signOut(): Promise<void> {
  return (inflight ??= run().finally(() => {
    inflight = null;
  }));
}

async function run(): Promise<void> {
  // Needs the session, so before it is cleared; capped so a dead network can't hold sign-out.
  await Promise.race([unregisterToken(), new Promise((r) => setTimeout(r, 3000))]);
  queryClient.clear();
  await Promise.resolve(persister.removeClient()).catch(() => {});
  await authClient.signOut().catch(() => {});
}
