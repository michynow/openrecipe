import AsyncStorage from "@react-native-async-storage/async-storage";
import { copy } from "@openrecipe/core/copy";
import * as Notifications from "expo-notifications";

import { showToast } from "../components/ui/toast";
import { api } from "./api";
import { shouldRegister } from "./push-logic";

const TOKEN_KEY = "openrecipe.pushToken";
const ASKED_KEY = "openrecipe.pushAsked";

/** The app is open: the in-app PulseToasts announce Drafts, so no system banner. Set once at startup. */
export function initNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  Notifications.setNotificationChannelAsync("drafts", {
    name: copy.push.channelName,
    description: copy.push.channelDescription,
    importance: Notifications.AndroidImportance.HIGH,
  }).catch(() => {});
}

const read = (key: string) => AsyncStorage.getItem(key).catch(() => null);

/** Post the device's FCM token if the server doesn't have it yet. Quiet on failure; the next launch retries. */
export async function registerToken(token?: string): Promise<void> {
  try {
    const t = token ?? String((await Notifications.getDevicePushTokenAsync()).data);
    if (!shouldRegister(t, await read(TOKEN_KEY))) return;
    await api("POST /api/v1/push-tokens", { body: { token: t } });
    await AsyncStorage.setItem(TOKEN_KEY, t);
  } catch {}
}

/** Already allowed: register. Never prompts. */
export async function registerIfGranted(): Promise<void> {
  const perm = await Notifications.getPermissionsAsync().catch(() => null);
  if (perm?.granted) await registerToken();
}

/**
 * The one prompt, right after the Admin parks a link (they have just handed
 * work to the kitchen, so "tell me when it's done" is obvious). Asked once ever;
 * a "no" is final.
 */
export async function askForPush(): Promise<void> {
  try {
    if ((await read(ASKED_KEY)) || (await Notifications.getPermissionsAsync()).granted) return registerIfGranted();
    await AsyncStorage.setItem(ASKED_KEY, "1");
    showToast({ message: copy.push.ask });
    if ((await Notifications.requestPermissionsAsync()).granted) await registerToken();
  } catch {}
}

/**
 * Sign-out: tell the server to forget this phone, then forget the token here.
 * Best-effort. ponytail: if the delete fails, the row stays with the old owner
 * and this phone keeps getting their Draft pushes until the next Admin signs in
 * here (registering the same token reassigns it). A household phone; add a
 * retry queue if that ever matters.
 */
export async function unregisterToken(): Promise<void> {
  try {
    const token = await read(TOKEN_KEY);
    if (token) await api("POST /api/v1/push-tokens/delete", { body: { token } });
  } catch {}
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}
