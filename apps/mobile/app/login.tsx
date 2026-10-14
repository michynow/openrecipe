import { copy } from "@openrecipe/core/copy";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";

import { ArcadeButton } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Kielbas } from "../components/ui/kielbas";
import { Screen } from "../components/ui/screen";
import { authClient } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setPending(true);
    const result = await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(
        result.error.status === 401
          ? copy.auth.invalidCredentials
          : result.error.status === 429
            ? copy.auth.tooManyAttempts
            : copy.common.somethingFailed,
      );
    }
    // On success useSession() updates and the layout gate redirects.
  }

  const input =
    "min-h-11 rounded-input border-2 border-line bg-surface px-3 py-2 font-body text-base text-text";

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center p-6">
        <View className="items-center">
          <Kielbas size={96} />
        </View>
        <Text className="mb-4 text-center font-display text-3xl uppercase text-text">{copy.auth.title}</Text>
        <Card className="gap-3 p-4">
          <Text className="font-bold text-sm text-text">{copy.auth.email}</Text>
          <TextInput
            className={input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />

          <Text className="font-bold text-sm text-text">{copy.auth.password}</Text>
          <TextInput
            className={input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {error ? <Text className="font-bold text-accent">{error}</Text> : null}

          <ArcadeButton
            label={pending ? copy.auth.signingIn : copy.auth.signIn}
            onPress={submit}
            disabled={pending}
            tone="accent"
          />

          {/* TODO(phase2): Google via authClient.signIn.social({ provider: "google", callbackURL: "/" }) */}
          <ArcadeButton label={copy.auth.google} onPress={() => {}} tone="surface" disabled />
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}
