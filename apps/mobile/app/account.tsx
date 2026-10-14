import { copy } from "@openrecipe/core/copy";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";

import { AccountScreenBody } from "../components/account/forms";
import { ArcadeButton } from "../components/ui/button";
import { Screen } from "../components/ui/screen";
import { useMe } from "../lib/api";
import { pushEnabled, setPushEnabled } from "../lib/push";
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

/** Draft-finished pushes. Admin-only, like Drafts themselves. */
function PushChoice() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => pushEnabled().then(setOn), []);

  // Coming back from the system settings may have changed the permission.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1 gap-1">
        <Text className="font-display text-xl uppercase text-text">{copy.account.push.title}</Text>
        <Text className="font-body text-sm text-muted">{copy.account.push.hint}</Text>
      </View>
      <Switch
        accessibilityLabel={copy.account.push.title}
        value={on}
        disabled={busy}
        onValueChange={async (next) => {
          setBusy(true);
          setOn(await setPushEnabled(next));
          setBusy(false);
        }}
      />
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
        {me.data?.isAdmin === true ? <PushChoice /> : null}
        <ArcadeButton
          label={copy.appDownload.shareApp}
          tone="surface"
          onPress={() => {
            const url = `${process.env.EXPO_PUBLIC_API_URL}/app`;
            Share.share({ message: `${copy.appDownload.shareMessage} ${url}`, url });
          }}
        />
        <ArcadeButton label={copy.nav.signOut} tone="surface" onPress={() => signOut()} />
      </ScrollView>
    </Screen>
  );
}
