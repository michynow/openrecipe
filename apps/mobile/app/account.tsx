import { copy } from "@openrecipe/core/copy";
import { ScrollView } from "react-native";

import { AccountScreenBody } from "../components/account/forms";
import { ArcadeButton } from "../components/ui/button";
import { Screen } from "../components/ui/screen";
import { useMe } from "../lib/api";
import { signOut } from "../lib/sign-out";

/** Name, password and sign out: for everyone, Members included. */
export default function Account() {
  const me = useMe();
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 p-4 pb-12" keyboardShouldPersistTaps="handled">
        <AccountScreenBody name={me.data?.name ?? ""} />
        <ArcadeButton label={copy.nav.signOut} tone="surface" onPress={() => signOut()} />
      </ScrollView>
    </Screen>
  );
}
