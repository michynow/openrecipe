import { authClient } from "./auth";
import { persister, queryClient } from "./query-client";

/**
 * The one way out. Drops this user's data before the next one signs in: the
 * in-memory cache (home, search, tags, recipes) and the persisted offline copy in
 * AsyncStorage, then the session itself. Each step is best-effort, so a dead
 * network still leaves the phone signed out locally.
 */
export async function signOut(): Promise<void> {
  queryClient.clear();
  await Promise.resolve(persister.removeClient()).catch(() => {});
  await authClient.signOut().catch(() => {});
}
