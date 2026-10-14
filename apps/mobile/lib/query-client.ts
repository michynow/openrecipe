import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";

import { pruneRecipes, shouldPersist } from "./persist";

const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * HOUR;

export const queryClient = new QueryClient({
  defaultOptions: {
    // offlineFirst: a cached Recipe renders without a network instead of pausing.
    queries: { gcTime: 24 * HOUR, retry: 1, networkMode: "offlineFirst" },
    // The cook log needs the server: fail at once offline so the UI rolls back.
    mutations: { networkMode: "always" },
  },
});

// A restored query must outlive the persister's maxAge or it is collected on hydrate.
queryClient.setQueryDefaults(["recipe"], { gcTime: WEEK });

export const persister = createAsyncStoragePersister({ storage: AsyncStorage });

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: {
    ...persister,
    persistClient: (client) =>
      persister.persistClient({
        ...client,
        clientState: {
          ...client.clientState,
          queries: pruneRecipes(client.clientState.queries),
        },
      }),
  },
  maxAge: WEEK,
  buster: Constants.expoConfig?.version ?? "",
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
};
