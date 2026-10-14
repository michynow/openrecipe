import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
export const THEME_PREFS: readonly ThemePref[] = ["system", "light", "dark"];

const KEY = "openrecipe.theme";

/**
 * The one source of truth is the OS appearance override: nativewind's
 * colorScheme.set() forwards to Appearance.setColorScheme(), so RN's
 * useColorScheme() (useTokens, expo-status-bar "auto") and NativeWind's own
 * scheme all follow it, instantly. "system" clears the override.
 */
export async function applyStoredTheme(): Promise<ThemePref> {
  let pref: ThemePref = "system";
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === "light" || raw === "dark") pref = raw;
  } catch {}
  colorScheme.set(pref);
  return pref;
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    applyStoredTheme().then(setPref);
  }, []);
  const choose = useCallback((next: ThemePref) => {
    setPref(next);
    colorScheme.set(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);
  return [pref, choose];
}
