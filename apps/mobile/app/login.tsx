import { copy } from "@openrecipe/core/copy";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

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

  return (
    <View className="flex-1 justify-center gap-4 bg-bg p-6">
      <Text className="text-3xl font-bold uppercase text-text">{copy.auth.title}</Text>

      <Text className="text-sm text-muted">{copy.auth.email}</Text>
      <TextInput
        className="rounded-input border-2 border-line bg-surface px-3 py-2 text-text"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />

      <Text className="text-sm text-muted">{copy.auth.password}</Text>
      <TextInput
        className="rounded-input border-2 border-line bg-surface px-3 py-2 text-text"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      {error ? <Text className="text-accent">{error}</Text> : null}

      <Pressable
        onPress={submit}
        disabled={pending}
        className="items-center rounded-input border-2 border-line bg-accent py-3"
      >
        <Text className="font-bold text-accent-ink">
          {pending ? copy.auth.signingIn : copy.auth.signIn}
        </Text>
      </Pressable>

      {/* TODO(phase2): Google via authClient.signIn.social({ provider: "google", callbackURL: "/" }) */}
      <Pressable disabled className="items-center rounded-input border-2 border-line bg-fill py-3 opacity-50">
        <Text className="text-text">{copy.auth.google}</Text>
      </Pressable>
    </View>
  );
}
