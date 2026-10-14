import { useRouter, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { draftRoute } from "../../lib/push-logic";
import { registerIfGranted, registerToken } from "../../lib/push";

/** Mounted for every signed-in user so a tap always routes; only Admins register a device. */
export function PushHost({ admin }: { admin: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      // Handled once: PushHost remounts when the session flips, and the cold-start
      // response would otherwise open the same Draft again each time.
      Notifications.clearLastNotificationResponse();
      const href = draftRoute(r?.notification.request.content.data);
      if (href) router.navigate(href as Href);
    };
    // Cold start: the tap that launched the app.
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) open(r);
    }).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if (r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) open(r);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (!admin) return;
    registerIfGranted();
    const sub = Notifications.addPushTokenListener((t) => registerToken(String(t.data)));
    return () => sub.remove();
  }, [admin]);

  return null;
}
