import type { AccountResult } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useChangePassword, useUpdateName } from "../../lib/hooks/admin";
import { ArcadeButton } from "../ui/button";
import { Card } from "../ui/card";
import { HEADING, INPUT } from "../settings/styles";

/** The server's own Polish message, inline. */
function Status({ result }: { result: AccountResult | null }) {
  if (!result) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      accessibilityRole={result.ok ? undefined : "alert"}
      className={`font-bold text-sm ${result.ok ? "text-text" : "text-accent"}`}
    >
      {result.message}
    </Text>
  );
}

const failure: AccountResult = { ok: false, message: copy.common.somethingFailed };

export function NameForm({ name }: { name: string }) {
  const update = useUpdateName();
  const [value, setValue] = useState(name);
  const [result, setResult] = useState<AccountResult | null>(null);
  // The name arrives after the first render when the session is still loading.
  useEffect(() => setValue(name), [name]);

  function submit() {
    if (value.trim() === "") return setResult({ ok: false, message: copy.account.nameRequired });
    update.mutate(value.trim(), { onSuccess: setResult, onError: () => setResult(failure) });
  }

  return (
    <Card className="gap-3 p-4">
      <Text className={HEADING}>{copy.account.profile}</Text>
      <Text className="font-body text-sm text-muted">{copy.join.yourName}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        accessibilityLabel={copy.join.yourName}
        autoComplete="name"
        editable={!update.isPending}
        className={INPUT}
      />
      <Status result={result} />
      <ArcadeButton label={copy.account.save} tone="accent" disabled={update.isPending} onPress={submit} />
    </Card>
  );
}

export function PasswordForm() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [result, setResult] = useState<AccountResult | null>(null);

  function submit() {
    if (next.length < 8) return setResult({ ok: false, message: copy.account.passwordTooShort });
    // An empty current password means "set one" (Google-only accounts), as on the web.
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: (res) => {
          setResult(res);
          if (res.ok) {
            setCurrent("");
            setNext("");
          }
        },
        onError: () => setResult(failure),
      },
    );
  }

  return (
    <Card className="gap-3 p-4">
      <Text className={HEADING}>{copy.auth.password}</Text>
      <Text className="font-body text-sm text-muted">{copy.account.currentPassword}</Text>
      <TextInput
        value={current}
        onChangeText={setCurrent}
        accessibilityLabel={copy.account.currentPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        editable={!change.isPending}
        className={INPUT}
      />
      <Text className="font-body text-sm text-muted">{copy.account.currentPasswordHint}</Text>
      <Text className="font-body text-sm text-muted">{copy.account.newPassword}</Text>
      <TextInput
        value={next}
        onChangeText={setNext}
        accessibilityLabel={copy.account.newPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        editable={!change.isPending}
        className={INPUT}
      />
      <Status result={result} />
      <ArcadeButton label={copy.account.changePassword} tone="accent" disabled={change.isPending} onPress={submit} />
    </Card>
  );
}

export function AccountScreenBody({ name }: { name: string }) {
  return (
    <View className="gap-5">
      <NameForm name={name} />
      <PasswordForm />
    </View>
  );
}
