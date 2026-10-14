import { expoClient } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    // ponytail: in better-auth 1.6.25 expoClient's `getActions` type doesn't
    // line up with BetterAuthClientPlugin (one copy of every package, so it's
    // the library typing, not a duplicate install). Cast, and type `getCookie`
    // by hand below. Drop both when an upgrade typechecks without them.
    expoClient({
      scheme: "openrecipe",
      storagePrefix: "openrecipe",
      storage: SecureStore,
    }) as BetterAuthClientPlugin,
  ],
});

/** The session cookie the expo plugin keeps in SecureStore, for API calls. */
export const getCookie = (): string =>
  (authClient as unknown as { getCookie(): string }).getCookie();
