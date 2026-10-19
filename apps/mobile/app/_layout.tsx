import "../global.css";

import { Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2";
import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { copy } from "@openrecipe/core/copy";
import { focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { useNetworkState } from "expo-network";
import { Stack } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Text, View } from "react-native";
import { vars } from "nativewind";

import { PushHost } from "../components/drafts/push-host";
import { PulseToasts } from "../components/drafts/pulse-toasts";
import { ShareHandler } from "../components/drafts/share-handler";
import { ToastHost } from "../components/ui/toast";
import { useIsAdmin } from "../lib/hooks/admin";
import { authClient, getCookie } from "../lib/auth";
import { initNotifications } from "../lib/push";
import { persistOptions, queryClient } from "../lib/query-client";
import { cssVars, useTokens } from "../lib/theme";
import { applyStoredTheme } from "../lib/theme-pref";

SplashScreen.preventAutoHideAsync().catch(() => {});
initNotifications();

// The share intent is a native module: it does not exist in Expo Go.
const SHARE_INTENT_OPTIONS = { disabled: Constants.executionEnvironment === "storeClient" };

/** Draft polling, for admins only; it pauses while the app is in the background. */
function AdminEffects() {
  const admin = useIsAdmin();
  return (
    <>
      <PushHost admin={admin.data === true} />
      {admin.data === true ? <PulseToasts /> : null}
    </>
  );
}

/**
 * The root navigator, always mounted: Expo Router needs a navigator here, and a
 * <Redirect> in its place loops ("Maximum update depth exceeded"). Who sees what
 * is decided by Stack.Protected instead.
 */
function Shell({ offline }: { offline: boolean }) {
  const { color } = useTokens();
  const { data: session, isPending, error } = authClient.useSession();

  // No answer about the session (offline, or the API unreachable): a stored
  // cookie means we were signed in, so stay in the app; a dead one is cleared by
  // the 401 path. After sign-out the cookie is "", so nobody gets in this way.
  const unknown = offline || !!error;
  const signedIn = !!session || (unknown && getCookie() !== "");
  const waiting = isPending && !unknown;

  useEffect(() => {
    if (!waiting) SplashScreen.hideAsync().catch(() => {});
  }, [waiting]);

  if (waiting) return null; // the splash screen is still up

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.gold },
          headerTintColor: color.ink,
          headerTitleStyle: { fontFamily: "Baloo2_800ExtraBold", color: color.ink },
          contentStyle: { backgroundColor: color.bg },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Titles here too: a screen sets its own only once its data loads, and until then the header shows the route name. */}
          <Stack.Screen name="recipe/[slug]" options={{ title: "" }} />
          <Stack.Screen name="editor/new" options={{ title: copy.editor.newTitle }} />
          <Stack.Screen name="editor/[slug]" options={{ title: copy.editor.editTitle }} />
          <Stack.Screen name="drafts/[id]" options={{ title: copy.imports.reviewTitle }} />
          <Stack.Screen name="account" options={{ title: copy.account.title }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <ShareHandler signedIn={signedIn} />
      {signedIn ? <AdminEffects /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({ Baloo2_800ExtraBold, Nunito_600SemiBold, Nunito_800ExtraBold });
  const { scheme } = useTokens();
  const offline = useNetworkState().isConnected === false;

  // The saved Light/Dark/System choice overrides the OS appearance; useTokens follows it.
  useEffect(() => {
    applyStoredTheme();
  }, []);

  // Polling and refetches pause in the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => sub.remove();
  }, []);

  // A font that fails to load falls back to the system font, not a stuck splash.
  if (!fontsReady && !fontError) return null;

  return (
    <ShareIntentProvider options={SHARE_INTENT_OPTIONS}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <View style={vars(cssVars(scheme))} className="flex-1 bg-bg">
          <StatusBar style="auto" />
          <View className="flex-1">
            <Shell offline={offline} />
            <ToastHost />
          </View>
          {offline ? (
            <View accessibilityRole="alert" className="bg-ink px-4 py-1.5">
              <Text className="text-center font-body text-xs text-gold">{copy.common.offline}</Text>
            </View>
          ) : null}
        </View>
      </PersistQueryClientProvider>
    </ShareIntentProvider>
  );
}
