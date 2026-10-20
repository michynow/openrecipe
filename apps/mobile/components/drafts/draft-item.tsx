import type { DraftRow } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { DRAFT_STAGES, type DraftLogEntry } from "@openrecipe/core/drafts";
import { isHttpUrl } from "@openrecipe/core/recipe-schema";
import { formatClock, formatElapsed, formatRelativeDays } from "@openrecipe/core/format";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { useDiscardDraft, useRetryDraft } from "../../lib/hooks/drafts";
import { ArcadeButton } from "../ui/button";
import { Card } from "../ui/card";
import { showDialog } from "../ui/dialog";

const STATUS_TONE: Record<DraftRow["status"], string> = {
  ready: "bg-leaf",
  processing: "bg-sky",
  queued: "bg-gold",
  limited: "bg-gold",
  failed: "bg-accent2",
  approved: "bg-fill",
  discarded: "bg-fill",
};
const STATUS_TEXT: Partial<Record<DraftRow["status"], string>> = {
  failed: "text-accent-ink",
  discarded: "text-muted",
};

/** Status as a word, never colour alone: green your turn, sky the kitchen is on it, gold waiting, grape broke. */
function StatusChip({ status }: { status: DraftRow["status"] }) {
  return (
    <View className={`self-start rounded-input border-2 border-line px-2.5 py-0.5 ${STATUS_TONE[status]}`}>
      <Text className={`font-bold text-sm uppercase ${STATUS_TEXT[status] ?? "text-ink"}`}>
        {copy.imports.status[status]}
      </Text>
    </View>
  );
}

const host = (url: string) => (isHttpUrl(url) ? new URL(url.trim()).host : url);

/** queued, then the Worker's own steps: one segment each. */
const STEPS = ["queued", ...DRAFT_STAGES] as const;

/** A ticking clock since `since`, only while this screen is focused: m:ss, then hours, then days. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }, []),
  );
  return <>{formatElapsed((now - new Date(since).getTime()) / 1000, copy.units.days)}</>;
}

function Progress({ draft }: { draft: DraftRow }) {
  const queued = draft.status === "queued";
  const current = queued ? 0 : Math.max(0, STEPS.indexOf(draft.stage ?? "fetching"));
  const since = queued ? draft.queuedAt : (draft.claimedAt ?? draft.queuedAt);
  const { steps, step, waiting, working, queuedHint } = copy.imports.progress;
  return (
    <View className="gap-2">
      <View
        accessibilityLabel={`${step} ${current + 1}/${STEPS.length}: ${steps[STEPS[current]]}`}
        className="flex-row gap-1.5"
      >
        {STEPS.map((name, i) => (
          <View
            key={name}
            className={`h-5 flex-1 rounded-full border-2 border-line ${i < current ? "bg-leaf" : i === current ? "bg-sky" : "bg-fill"}`}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text className="font-bold text-base text-text">
          {step} {current + 1}/{STEPS.length} · {steps[STEPS[current]]}…
        </Text>
        <Text className="font-body text-sm text-muted">
          {queued ? waiting : working} <Elapsed since={since} />
        </Text>
      </View>
      {queued ? <Text className="font-body text-sm text-muted">{queuedHint}</Text> : null}
    </View>
  );
}

const LEVEL: Record<DraftLogEntry["level"], string> = { info: "bg-leaf", warn: "bg-gold", error: "bg-accent2" };

// Household clock, pinned: the Worker logs in UTC.
const logTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** http(s) links in a log line become tappable; nothing else does. */
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/\S+)/).map((part, i) =>
    isHttpUrl(part) ? (
      <Text
        key={i}
        accessibilityRole="link"
        onPress={() => Linking.openURL(part).catch(() => {})}
        className="text-accent underline"
      >
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

/** Collapsed by default with the latest line as its summary; the full story is one tap away. */
function DraftLog({ entries }: { entries: DraftLogEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-input border-2 border-line bg-bg">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        className="min-h-11 flex-row items-center gap-2 px-3"
      >
        <Text className="font-bold text-sm text-text">{open ? "▾" : "▸"}</Text>
        <Text className="font-bold text-sm uppercase text-text">
          {copy.imports.log.toggle} ({entries.length})
        </Text>
        {open ? null : (
          <Text numberOfLines={1} className="min-w-0 flex-1 font-body text-sm text-muted">
            {entries[entries.length - 1]?.msg}
          </Text>
        )}
      </Pressable>
      {open ? (
        <View className="gap-1.5 border-t-2 border-line px-3 py-2">
          {entries.map((entry, i) => (
            <View key={i} className="flex-row items-baseline gap-2">
              <View className={`h-2.5 w-2.5 rounded-full border border-line ${LEVEL[entry.level]}`} />
              <Text className="font-body text-xs text-muted">{logTime.format(new Date(entry.at))}</Text>
              <Text className="min-w-0 flex-1 font-body text-sm text-text">{linkify(entry.msg)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function DraftItem({ draft }: { draft: DraftRow }) {
  const router = useRouter();
  const retry = useRetryDraft();
  const discard = useDiscardDraft();
  const canRetry = draft.status === "failed" || draft.status === "ready" || draft.status === "limited";
  const canDiscard = draft.status !== "approved" && draft.status !== "discarded";
  const moving = draft.status === "queued" || draft.status === "processing";
  const busy = retry.isPending || discard.isPending;
  const failed = retry.isError || discard.isError || retry.data?.ok === false || discard.data?.ok === false;

  const confirmDiscard = () =>
    showDialog(copy.imports.discardConfirm, undefined, [
      { text: copy.editor.cancel, style: "cancel" },
      { text: copy.imports.discard, style: "destructive", onPress: () => discard.mutate(draft.id) },
    ]);

  return (
    <Card className="gap-3 p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <StatusChip status={draft.status} />
        <Text className="font-body text-sm text-muted">{formatRelativeDays(draft.createdAt)}</Text>
      </View>

      <Text className="font-display text-lg text-text" numberOfLines={1}>
        {draft.title ?? host(draft.sourceUrl)}
      </Text>
      <Text numberOfLines={2} className="font-body text-xs text-muted">
        {draft.sourceUrl}
      </Text>

      {moving ? <Progress draft={draft} /> : null}

      {draft.status === "limited" ? (
        <Text className="font-bold text-base text-text">{copy.imports.limitedHint(formatClock(draft.queuedAt))}</Text>
      ) : null}

      {draft.status === "failed" ? (
        <Text accessibilityRole="alert" className="font-bold text-base text-accent">
          {draft.error ?? copy.imports.failedFallback}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {draft.status === "ready" ? (
          <ArcadeButton
            label={copy.imports.review}
            tone="accent"
            onPress={() => router.push({ pathname: "/drafts/[id]", params: { id: draft.id } })}
          />
        ) : null}
        {canRetry ? (
          <ArcadeButton label={copy.imports.retry} tone="surface" disabled={busy} onPress={() => retry.mutate(draft.id)} />
        ) : null}
        {canDiscard ? (
          <ArcadeButton label={copy.imports.discard} tone="surface" disabled={busy} onPress={confirmDiscard} />
        ) : null}
      </View>

      {failed ? (
        <Text accessibilityRole="alert" className="font-bold text-sm text-accent">
          {copy.common.somethingFailed}
        </Text>
      ) : null}

      {draft.log.length > 0 ? <DraftLog entries={draft.log} /> : null}
    </Card>
  );
}
