import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Slot, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { authClient } from "../lib/auth";

function Gate() {
  const { data: session, isPending } = authClient.useSession();
  const onLogin = useSegments()[0] === "login";

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }
  if (!session && !onLogin) return <Redirect href="/login" />;
  if (session && onLogin) return <Redirect href="/" />;
  return <Slot />;
}

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <StatusBar style="dark" />
      <Gate />
    </QueryClientProvider>
  );
}
