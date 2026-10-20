import type { Invite } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { formatRelativeDays } from "@openrecipe/core/format";
import { useState } from "react";
import { Pressable, Share, Text, TextInput, View } from "react-native";

import { useMintInvite, useRevokeInvite } from "../../lib/hooks/admin";
import { API_URL } from "../../lib/auth";
import { ArcadeButton } from "../ui/button";
import { Card } from "../ui/card";
import { showDialog } from "../ui/dialog";
import { HEADING, INPUT } from "./styles";

const stateOf = (i: Invite) =>
  i.revokedAt ? "revoked" : i.usedAt ? "used" : i.expired ? "expired" : "open";

function InviteRow({ invite }: { invite: Invite }) {
  const revoke = useRevokeInvite();
  const state = stateOf(invite);

  // Invites are redeemed on the web: API_URL is the web origin.
  const share = () => Share.share({ message: `${API_URL}/join/${invite.token}` }).catch(() => {});
  const confirmRevoke = () =>
    showDialog(`${copy.settings.revoke}?`, invite.email ?? undefined, [
      { text: copy.editor.cancel, style: "cancel" },
      { text: copy.settings.revoke, style: "destructive", onPress: () => revoke.mutate(invite.id) },
    ]);

  return (
    <View className="gap-2 rounded-card border-2 border-line bg-surface px-3 py-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-body text-sm text-muted">{invite.token.slice(0, 10)}…</Text>
        {invite.email ? <Text className="font-body text-sm text-muted">{invite.email}</Text> : null}
        <View
          className={`rounded-input border-2 border-line px-2 ${state === "open" ? "bg-leaf" : "bg-fill"}`}
        >
          <Text className="font-bold text-xs uppercase text-ink">
            {state === "open" ? copy.settings.inviteState.open : copy.settings.inviteState[state]}
          </Text>
        </View>
        {state === "open" ? (
          <Text className="font-body text-sm text-text">{formatRelativeDays(invite.expiresAt)}</Text>
        ) : null}
      </View>
      {state === "open" ? (
        <View className="flex-row flex-wrap items-center gap-3">
          <ArcadeButton label={copy.settings.shareInvite} icon="external" tone="gold" onPress={share} />
          <Pressable
            accessibilityRole="button"
            disabled={revoke.isPending}
            onPress={confirmRevoke}
            className="min-h-11 justify-center px-2"
          >
            <Text className="font-bold text-sm text-accent underline">{copy.settings.revoke}</Text>
          </Pressable>
        </View>
      ) : null}
      {revoke.isError ? (
        <Text accessibilityRole="alert" className="font-bold text-sm text-accent">
          {copy.common.somethingFailed}
        </Text>
      ) : null}
    </View>
  );
}

export function InvitesSection({ invites }: { invites: Invite[] }) {
  const mint = useMintInvite();
  const [email, setEmail] = useState("");

  return (
    <Card className="gap-3 p-4">
      <Text className={HEADING}>{copy.settings.invites}</Text>
      <Text className="font-body text-sm text-muted">{copy.settings.inviteHint}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={copy.auth.email}
        accessibilityLabel={copy.auth.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        className={INPUT}
      />
      <ArcadeButton
        label={copy.settings.mintInvite}
        tone="accent"
        disabled={mint.isPending}
        onPress={() => mint.mutate(email.trim() || null, { onSuccess: (r) => r.ok && setEmail("") })}
      />
      {mint.isError || mint.data?.ok === false ? (
        <Text accessibilityRole="alert" className="font-bold text-sm text-accent">
          {copy.common.somethingFailed}
        </Text>
      ) : null}
      <View className="gap-2">
        {invites.slice(0, 20).map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
        {invites.length === 0 ? <Text className="font-body text-sm text-muted">—</Text> : null}
      </View>
    </Card>
  );
}
