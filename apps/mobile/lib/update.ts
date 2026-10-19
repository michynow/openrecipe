import { copy } from "@openrecipe/core/copy";
import Constants from "expo-constants";
import { Linking } from "react-native";

import { showToast } from "../components/ui/toast";
import { APK_URL, isNewer, RELEASES_API } from "./update-logic";

export const installedVersion = Constants.expoConfig?.version ?? null;

/** The newest release's version when it is newer than this install, else null. Quiet on failure. */
export async function newerVersion(): Promise<string | null> {
  try {
    const res = await fetch(RELEASES_API, { headers: { accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const { tag_name } = (await res.json()) as { tag_name?: string };
    return isNewer(tag_name, installedVersion) ? tag_name!.replace(/^mobile-v/, "") : null;
  } catch {
    return null;
  }
}

/** The browser downloads the APK; installing it over this one keeps every setting (same signing key). */
export const openApk = () => Linking.openURL(APK_URL).catch(() => {});

const EVERY_MS = 6 * 60 * 60 * 1000;
let lastCheck = 0;

/** On launch and on return to the app, at most every few hours: a toast with the download, once per check. */
export async function checkForUpdate(): Promise<void> {
  if (Date.now() - lastCheck < EVERY_MS) return;
  lastCheck = Date.now();
  const version = await newerVersion();
  if (version) {
    showToast({
      message: copy.update.available(version),
      action: { label: copy.update.install, onPress: openApk },
      durationMs: 15_000,
    });
  }
}
