import { copy } from "@openrecipe/core/copy";
import { useRootNavigationState, useRouter, type Href } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useEffect } from "react";

import { useIsAdmin } from "../../lib/hooks/admin";
import { extractUrl } from "../../lib/share-intent";
import { showToast } from "../ui/toast";

/**
 * A page shared from Chrome. Admin: open the Drafts tab with the link prefilled;
 * parking it stays one deliberate tap, so a stray share queues nothing.
 * Anyone else gets a toast and nothing is parked.
 */
export function ShareHandler({ signedIn }: { signedIn: boolean }) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const router = useRouter();
  const navReady = !!useRootNavigationState()?.key;
  const admin = useIsAdmin(signedIn);
  const roleLoading = signedIn && admin.isPending && admin.fetchStatus === "fetching";

  useEffect(() => {
    if (!hasShareIntent || !navReady || roleLoading) return;
    const url = extractUrl(shareIntent.text) ?? extractUrl(shareIntent.webUrl);
    if (!signedIn) showToast({ message: copy.share.notSignedIn, kielbas: false });
    else if (admin.data !== true) showToast({ message: copy.share.notAdmin, kielbas: false });
    else if (!url) showToast({ message: copy.share.noUrl, kielbas: false });
    else {
      // `shared` changes on every share, so sharing the same link twice still prefills.
      router.navigate({ pathname: "/drafts", params: { url, shared: String(Date.now()) } } as Href);
      showToast({ message: copy.share.announce });
    }
    resetShareIntent();
  }, [hasShareIntent, navReady, roleLoading, signedIn, admin.data, shareIntent, router, resetShareIntent]);

  return null;
}
