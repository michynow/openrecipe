import "../global.css";

import { Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2";
import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { copy } from "@openrecipe/core/copy";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import { useNetworkState } from "expo-network";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { vars } from "nativewind";

import { authClient, getCookie } from "../lib/auth";
import { persistOptions, queryClient } from "../lib/query-client";
import { cssVars, useTokens } from "../lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

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
        <Stack.Screen name="recipe/[slug]" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({ Baloo2_800ExtraBold, Nunito_600SemiBold, Nunito_800ExtraBold });
  const { scheme } = useTokens();
  const offline = useNetworkState().isConnected === false;

  // A font that fails to load falls back to the system font, not a stuck splash.
  if (!fontsReady && !fontError) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <View style={vars(cssVars(scheme))} className="flex-1 bg-bg">
        <StatusBar style="auto" />
        <View className="flex-1">
          <Shell offline={offline} />
        </View>
        {offline ? (
          <View accessibilityRole="alert" className="bg-ink px-4 py-1.5">
            <Text className="text-center font-body text-xs text-gold">{copy.common.offline}</Text>
          </View>
        ) : null}
      </View>
    </PersistQueryClientProvider>
  );
}
