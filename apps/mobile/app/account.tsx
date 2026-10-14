import { copy } from "@openrecipe/core/copy";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AccountScreenBody } from "../components/account/forms";
import { ArcadeButton } from "../components/ui/button";
import { Screen } from "../components/ui/screen";
import { useMe } from "../lib/api";
import { signOut } from "../lib/sign-out";
import { THEME_PREFS, useThemePref } from "../lib/theme-pref";

function ThemeChoice() {
  const [pref, choose] = useThemePref();
  return (
    <View className="gap-2">
      <Text className="font-display text-xl uppercase text-text">{copy.account.theme.title}</Text>
      <View accessibilityRole="radiogroup" className="flex-row gap-2">
        {THEME_PREFS.map((p) => (
          <Pressable
            key={p}
            accessibilityRole="radio"
            accessibilityState={{ checked: pref === p }}
            onPress={() => choose(p)}
            className={`min-h-11 flex-1 items-center justify-center rounded-input border-2 border-line px-2 ${pref === p ? "bg-accent" : "bg-surface"}`}
          >
            <Text className={`font-display text-sm uppercase ${pref === p ? "text-accent-ink" : "text-ink"}`}>
              {copy.account.theme[p]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Name, password and sign out: for everyone, Members included. */
export default function Account() {
  const me = useMe();
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 p-4 pb-12" keyboardShouldPersistTaps="handled">
        <AccountScreenBody name={me.data?.name ?? ""} />
        <ThemeChoice />
        <ArcadeButton label={copy.nav.signOut} tone="surface" onPress={() => signOut()} />
      </ScrollView>
    </Screen>
  );
}
