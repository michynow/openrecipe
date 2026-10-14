import type { Member } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { formatDate } from "@openrecipe/core/format";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { useRemoveMember, useSetMemberRole } from "../../lib/hooks/admin";
import { ArcadeButton } from "../ui/button";
import { Card } from "../ui/card";
import { HEADING } from "./styles";

type Assignable = "admin" | "member";
const ROLES: Assignable[] = ["member", "admin"];

function MemberRow({ member }: { member: Member }) {
  const setRole = useSetMemberRole();
  const remove = useRemoveMember();
  const current: Assignable = member.role === "member" ? "member" : "admin";
  const [role, setLocal] = useState<Assignable>(current);
  const [refusal, setRefusal] = useState<string | null>(null);

  // The server's refusal (MemberResult) or a transport failure, as copy.
  const settle = (res: { ok: boolean; reason?: "master" | "missing" }) =>
    setRefusal(res.ok ? null : res.reason ? copy.settings.memberErrors[res.reason] : copy.common.somethingFailed);
  const fail = () => setRefusal(copy.common.somethingFailed);

  const confirmRemove = () =>
    Alert.alert(copy.settings.removeMemberConfirm, member.name, [
      { text: copy.editor.cancel, style: "cancel" },
      {
        text: copy.settings.remove,
        style: "destructive",
        onPress: () => remove.mutate(member.id, { onSuccess: settle, onError: fail }),
      },
    ]);

  return (
    <View className="gap-2 rounded-card border-2 border-line bg-surface px-3 py-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-bold text-base text-text">{member.name}</Text>
        {member.isMaster ? (
          <View className="rounded-input border-2 border-line bg-gold px-2">
            <Text className="font-bold text-xs uppercase text-ink">{copy.settings.master}</Text>
          </View>
        ) : null}
      </View>
      <Text className="font-body text-sm text-muted">{member.email}</Text>
      <Text className="font-body text-sm text-muted">
        {copy.account.roles[member.role]} · {copy.settings.joined} {formatDate(member.joinedAt)}
      </Text>

      {/* The Master cannot be demoted or removed: enforced server-side too. */}
      {member.isMaster ? null : (
        <>
          <View accessibilityLabel={`${copy.settings.role}: ${member.name}`} className="flex-row flex-wrap items-center gap-2">
            {ROLES.map((r) => (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === r }}
                onPress={() => setLocal(r)}
                className={`min-h-11 justify-center rounded-input border-2 border-line px-3 ${role === r ? "bg-gold" : "bg-bg"}`}
              >
                <Text className={`font-bold text-sm ${role === r ? "text-ink" : "text-text"}`}>
                  {copy.account.roles[r]}
                </Text>
              </Pressable>
            ))}
            <ArcadeButton
              label={copy.settings.saveRole}
              tone="surface"
              disabled={role === current || setRole.isPending}
              onPress={() => setRole.mutate({ id: member.id, role }, { onSuccess: settle, onError: fail })}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={remove.isPending}
            onPress={confirmRemove}
            className="min-h-11 justify-center self-start px-1"
          >
            <Text className="font-bold text-sm text-accent underline">{copy.settings.remove}</Text>
          </Pressable>
        </>
      )}
      {refusal ? (
        <Text accessibilityRole="alert" className="font-bold text-sm text-accent">
          {refusal}
        </Text>
      ) : null}
    </View>
  );
}

export function MembersSection({ members }: { members: Member[] }) {
  return (
    <Card className="gap-3 p-4">
      <Text className={HEADING}>{copy.settings.members}</Text>
      <Text className="font-body text-sm text-muted">{copy.settings.rolesHint}</Text>
      <View className="gap-2">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} />
        ))}
        {members.length <= 1 ? <Text className="font-body text-sm text-muted">{copy.settings.membersEmpty}</Text> : null}
      </View>
    </Card>
  );
}
